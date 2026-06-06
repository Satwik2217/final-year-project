// Session and chat routes — multimodal analysis, Gemini streaming, MongoDB persistence.
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const Session = require('../models/Session');
const Message = require('../models/Message');
const EmotionLog = require('../models/EmotionLog');
const { analyzeFace } = require('../services/deepfaceClient');
const { analyzeDistortion, retrieveRagContext, addToRagHistory } = require('../services/albertClient');
const { evaluateSafety, crisisResponse } = require('../services/safetyService');
const { detectContradiction } = require('../services/contradictionService');
const { inferTextEmotion, buildEmotionSummary } = require('../services/promptService');
const { streamGeminiResponse, generateGeminiResponse, streamHumanResponse, generateHumanResponse, isGeminiAvailable, humanizeReply } = require('../services/geminiService');

const router = express.Router();

async function loadSessionForUser(sessionId, userId) {
  const session = await Session.findOne({ _id: sessionId, userId });
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });
  return session;
}

function buildResponseContext(text, req, analysis, conversationMessages) {
  // Calculate emotion trend for narrative payoff
  let emotionTrend = 'Stable';
  if (analysis.sessionHistory && analysis.sessionHistory.length > 0) {
    const recentEmotions = analysis.sessionHistory.slice(0, 3).map(h => h.textEmotion);
    if (recentEmotions.every(e => e === 'Distress Detected') && analysis.textEmotion === 'Positive') {
      emotionTrend = 'Breakthrough detected (from distress to positive)';
    } else if (recentEmotions.includes('Distress Detected') && analysis.textEmotion === 'Balanced') {
      emotionTrend = 'Gradual stabilization';
    } else if (recentEmotions.includes('Positive') && analysis.textEmotion === 'Distress Detected') {
      emotionTrend = 'Recent emotional dip';
    }
  }

  return {
    userText: text.trim(),
    userName: req.user.name,
    textEmotion: analysis.textEmotion,
    facialEmotion: analysis.facialEmotion,
    actionUnits: analysis.actionUnits,
    cognitiveDistortion: analysis.cognitiveDistortion,
    contradiction: analysis.contradiction,
    ragContext: analysis.ragContext,
    sessionHistory: analysis.sessionHistory,
    conversationMessages,
    emotionTrend,
  };
}

async function buildAnalysis({ text, imageBase64, userId }) {
  const [faceResult, albertResult] = await Promise.all([
    analyzeFace(imageBase64),
    analyzeDistortion(text),
  ]);

  const facialEmotion = faceResult.dominant_emotion;
  const cognitiveDistortion = albertResult.cognitive_distortion;
  const textEmotion = inferTextEmotion(text, cognitiveDistortion);
  const contradiction = detectContradiction(text, facialEmotion);

  // Innovation: Pass userId to retrieve past context from RAG history
  const ragContext = await retrieveRagContext(text, cognitiveDistortion, userId);

  const sessionHistory = await EmotionLog.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return {
    facialEmotion,
    actionUnits: faceResult.action_units,
    cognitiveDistortion,
    textEmotion,
    contradiction,
    ragContext,
    sessionHistory,
    faceEngine: faceResult.engine,
    albertEngine: albertResult.engine,
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
    res.json(sessions);
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ message: 'Could not load sessions' });
  }
});

router.post('/', async (req, res) => {
  try {
    const session = await Session.create({ userId: req.user.id, title: req.body.title || 'New Session' });
    res.status(201).json(session);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Could not create session' });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    await loadSessionForUser(req.params.id, req.user.id);
    const messages = await Message.find({ sessionId: req.params.id }).sort({ createdAt: 1 }).lean();
    // Support both array and { messages } response shapes
    res.json(messages);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ message: error.message || 'Could not load messages' });
  }
});

router.post('/:id/messages', async (req, res) => {
  try {
    const { text, imageBase64 } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const session = await loadSessionForUser(req.params.id, req.user.id);
    const safety = evaluateSafety(text);

    const priorMessages = await Message.find({ sessionId: session._id })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();
    const conversationMessages = priorMessages.reverse().map((m) => ({ sender: m.sender, text: m.text }));

    const userMessage = await Message.create({
      sessionId: session._id,
      userId: req.user.id,
      sender: 'user',
      text: text.trim(),
    });

    if (safety.safetyTriggered) {
      const botText = crisisResponse(req.user.name);
      const aiMessage = await Message.create({
        sessionId: session._id,
        userId: req.user.id,
        sender: 'ai',
        text: botText,
        textEmotion: 'Distress Detected',
        techniqueUsed: 'Safety Escalation',
      });

      await EmotionLog.create({
        userId: req.user.id,
        sessionId: session._id,
        userText: text.trim(),
        textEmotion: 'Distress Detected',
        aiResponse: botText,
        techniqueUsed: 'Safety Escalation',
        emotionSummary: 'Crisis · immediate support',
      });

      return res.json({
        safetyTriggered: true,
        botResponse: botText,
        userMessage,
        aiMessage,
        message: aiMessage,
        quickReplies: ['I need help now', 'Tell me about helplines'],
      });
    }

    const analysis = await buildAnalysis({ text: text.trim(), imageBase64, userId: req.user.id });
    
    // Innovation: Save to RAG long-term memory
    addToRagHistory(req.user.id, session._id, text.trim(), analysis.cognitiveDistortion);

    const emotionSummary = buildEmotionSummary(
      analysis.textEmotion,
      analysis.facialEmotion,
      analysis.contradiction.contradictionDetected
    );

    let botResponse;
    const responseContext = buildResponseContext(text, req, analysis, conversationMessages);
    try {
      if (isGeminiAvailable()) {
        botResponse = await generateGeminiResponse(responseContext);
      } else {
        botResponse = await generateHumanResponse(responseContext);
      }
    } catch (geminiError) {
      console.warn('Gemini unavailable:', geminiError.message);
      botResponse = await generateHumanResponse(responseContext);
    }

    const aiMessage = await Message.create({
      sessionId: session._id,
      userId: req.user.id,
      sender: 'ai',
      text: botResponse,
      textEmotion: analysis.textEmotion,
      facialEmotion: analysis.facialEmotion,
      actionUnits: analysis.actionUnits,
      cognitiveDistortion: analysis.cognitiveDistortion,
      contradictionDetected: analysis.contradiction.contradictionDetected,
      emotionSummary,
      ragSourceId: analysis.ragContext.source_id || '',
      techniqueUsed: analysis.ragContext.technique || 'NeuroWell',
    });

    await Message.findByIdAndUpdate(userMessage._id, {
      textEmotion: analysis.textEmotion,
      facialEmotion: analysis.facialEmotion,
      actionUnits: analysis.actionUnits,
      cognitiveDistortion: analysis.cognitiveDistortion,
      contradictionDetected: analysis.contradiction.contradictionDetected,
      emotionSummary,
    });

    const savedUserMessage = await Message.findById(userMessage._id).lean();

    await EmotionLog.create({
      userId: req.user.id,
      sessionId: session._id,
      userText: text.trim(),
      textEmotion: analysis.textEmotion,
      facialEmotion: analysis.facialEmotion,
      actionUnits: analysis.actionUnits,
      cognitiveDistortion: analysis.cognitiveDistortion,
      contradictionDetected: analysis.contradiction.contradictionDetected,
      emotionSummary,
      aiResponse: botResponse,
      techniqueUsed: analysis.ragContext.technique || 'NeuroWell',
    });

    session.lastEmotion = analysis.textEmotion;
    session.lastDistortion = analysis.cognitiveDistortion;
    if (session.title === 'New Session') {
      session.title = text.trim().slice(0, 40);
    }
    await session.save();

    res.json({
      safetyTriggered: false,
      botResponse,
      userMessage: savedUserMessage,
      aiMessage,
      message: aiMessage,
      analysis: {
        textEmotion: analysis.textEmotion,
        facialEmotion: analysis.facialEmotion,
        actionUnits: analysis.actionUnits,
        cognitiveDistortion: analysis.cognitiveDistortion,
        contradictionDetected: analysis.contradiction.contradictionDetected,
        emotionSummary,
        ragSourceId: analysis.ragContext.source_id,
        techniqueUsed: analysis.ragContext.technique,
        faceEngine: analysis.faceEngine,
        albertEngine: analysis.albertEngine,
      },
      quickReplies: analysis.contradiction.contradictionDetected
        ? ["You're right, I'm not okay", 'Something is bothering me']
        : ['Tell me more', 'I have another question'],
    });
  } catch (error) {
    console.error('Send message error:', error);
    const status = error.status || 500;
    res.status(status).json({ message: error.message || 'Could not send message' });
  }
});

router.post('/:id/messages/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const { text, imageBase64 } = req.body;
    if (!text || !text.trim()) {
      sendEvent({ error: 'Message text is required' });
      return res.end();
    }

    const session = await loadSessionForUser(req.params.id, req.user.id);
    const safety = evaluateSafety(text);

    sendEvent({ started: true });

    const priorMessages = await Message.find({ sessionId: session._id })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();
    const conversationMessages = priorMessages.reverse().map((m) => ({ sender: m.sender, text: m.text }));

    const userMessage = await Message.create({
      sessionId: session._id,
      userId: req.user.id,
      sender: 'user',
      text: text.trim(),
    });

    if (safety.safetyTriggered) {
      const botText = crisisResponse(req.user.name);
      const aiMessage = await Message.create({
        sessionId: session._id,
        userId: req.user.id,
        sender: 'ai',
        text: botText,
        textEmotion: 'Distress Detected',
        techniqueUsed: 'Safety Escalation',
      });

      await EmotionLog.create({
        userId: req.user.id,
        sessionId: session._id,
        userText: text.trim(),
        textEmotion: 'Distress Detected',
        aiResponse: botText,
        techniqueUsed: 'Safety Escalation',
        emotionSummary: 'Crisis · immediate support',
      });

      sendEvent({ token: botText, done: true, safetyTriggered: true, messageId: aiMessage._id, userMessageId: userMessage._id });
      return res.end();
    }

    const analysis = await buildAnalysis({ text: text.trim(), imageBase64, userId: req.user.id });
    const emotionSummary = buildEmotionSummary(
      analysis.textEmotion,
      analysis.facialEmotion,
      analysis.contradiction.contradictionDetected
    );

    sendEvent({
      meta: true,
      analysis: {
        textEmotion: analysis.textEmotion,
        facialEmotion: analysis.facialEmotion,
        actionUnits: analysis.actionUnits,
        cognitiveDistortion: analysis.cognitiveDistortion,
        contradictionDetected: analysis.contradiction.contradictionDetected,
        emotionSummary,
        ragSourceId: analysis.ragContext.source_id,
        techniqueUsed: analysis.ragContext.technique,
      },
    });

    let fullResponse = '';
    const responseContext = buildResponseContext(text, req, analysis, conversationMessages);

    try {
      const streamSource = isGeminiAvailable()
        ? streamGeminiResponse(responseContext)
        : streamHumanResponse(responseContext);

      for await (const token of streamSource) {
        fullResponse += token;
        sendEvent({ token });
      }
    } catch (geminiError) {
      console.warn('Gemini stream unavailable:', geminiError.message);
      fullResponse = await generateHumanResponse(responseContext);
      sendEvent({ token: fullResponse });
    }

    fullResponse = humanizeReply(fullResponse.trim());

    const aiMessage = await Message.create({
      sessionId: session._id,
      userId: req.user.id,
      sender: 'ai',
      text: fullResponse,
      textEmotion: analysis.textEmotion,
      facialEmotion: analysis.facialEmotion,
      actionUnits: analysis.actionUnits,
      cognitiveDistortion: analysis.cognitiveDistortion,
      contradictionDetected: analysis.contradiction.contradictionDetected,
      emotionSummary,
      ragSourceId: analysis.ragContext.source_id || '',
      techniqueUsed: analysis.ragContext.technique || 'NeuroWell',
    });

    await Message.findByIdAndUpdate(userMessage._id, {
      textEmotion: analysis.textEmotion,
      facialEmotion: analysis.facialEmotion,
      actionUnits: analysis.actionUnits,
      cognitiveDistortion: analysis.cognitiveDistortion,
      contradictionDetected: analysis.contradiction.contradictionDetected,
      emotionSummary,
    });

    await EmotionLog.create({
      userId: req.user.id,
      sessionId: session._id,
      userText: text.trim(),
      textEmotion: analysis.textEmotion,
      facialEmotion: analysis.facialEmotion,
      actionUnits: analysis.actionUnits,
      cognitiveDistortion: analysis.cognitiveDistortion,
      contradictionDetected: analysis.contradiction.contradictionDetected,
      emotionSummary,
      aiResponse: fullResponse.trim(),
      techniqueUsed: analysis.ragContext.technique || 'NeuroWell',
    });

    session.lastEmotion = analysis.textEmotion;
    session.lastDistortion = analysis.cognitiveDistortion;
    if (session.title === 'New Session') session.title = text.trim().slice(0, 40);
    await session.save();

    sendEvent({ done: true, messageId: aiMessage._id, userMessageId: userMessage._id });
    res.end();
  } catch (error) {
    console.error('Stream message error:', error);
    sendEvent({ error: error.message || 'Stream failed' });
    res.end();
  }
});

router.post('/:id/face', async (req, res) => {
  try {
    await loadSessionForUser(req.params.id, req.user.id);
    const { imageBase64, image_base64 } = req.body;
    const result = await analyzeFace(imageBase64 || image_base64);
    res.json({
      dominant_emotion: result.dominant_emotion,
      action_units: result.action_units,
      confidence: result.confidence,
      engine: result.engine,
      emotions: result.emotions || {},
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ message: error.message || 'Face analysis failed' });
  }
});

module.exports = router;
