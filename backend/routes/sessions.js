const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Message = require('../models/Message');
const EmotionLog = require('../models/EmotionLog');
const User = require('../models/User');
const protect = require('../middleware/authMiddleware');
const { analyzeWithAI } = require('../services/aiService');
const { pickLoginGreeting } = require('../utils/greetings');

function buildMetrics(emotionLog, aiResult) {
  const detected = aiResult?.detectedEmotions || {};
  return {
    detectedExpression: aiResult?.textEmotion || emotionLog.textEmotion,
    emotionSummary: aiResult?.emotionSummary || emotionLog.emotionSummary,
    actionUnits: aiResult?.actionUnits || emotionLog.actionUnits || 'None',
    cognitiveDistortion: aiResult?.cognitiveDistortion || emotionLog.cognitiveDistortion,
    contradictionDetected: aiResult?.contradictionDetected ?? emotionLog.contradictionDetected,
    contradictionType: aiResult?.contradictionType || null,
    textEmotionHuman: detected.text_emotion_human || null,
    facialEmotionHuman: detected.facial_emotion_human || null,
    safetyStatus: aiResult?.safetyStatus || (emotionLog.severityScore >= 8 ? 'Alert' : 'Secure'),
    safetyTriggered: aiResult?.safetyTriggered || false,
    facialEmotion: aiResult?.facialEmotion || emotionLog.facialEmotion,
    visionEngine: aiResult?.visionEngine || 'None',
  };
}

router.post('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('name');
    const { sessionTitle, greetingType } = req.body;

    const session = new Session({
      userId: req.user.userId,
      sessionTitle: sessionTitle || 'Therapy Session',
    });
    await session.save();

    const messages = [];

    // Greet only on explicit login greeting — not on every new session
    if (greetingType === 'login') {
      const welcome = new Message({
        sessionId: session._id,
        sender: 'ai',
        text: pickLoginGreeting(user?.name, String(req.user.userId)),
      });
      await welcome.save();
      messages.push(welcome);
    }

    res.status(201).json({ session, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.userId }).sort({ startedAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/login-greeting', protect, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const existing = await Message.countDocuments({ sessionId: session._id });
    if (existing > 0) {
      return res.json({ skipped: true, reason: 'Session already has messages' });
    }

    const user = await User.findById(req.user.userId).select('name');
    const welcome = new Message({
      sessionId: session._id,
      sender: 'ai',
      text: pickLoginGreeting(user?.name, String(req.user.userId)),
    });
    await welcome.save();

    res.status(201).json({ message: welcome });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/messages', protect, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const messages = await Message.find({ sessionId: session._id }).sort({ createdAt: 1 });
    res.json({ session, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/messages', protect, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const { text, imageBase64 } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const user = await User.findById(req.user.userId).select('name');

    const priorMessages = await Message.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(16)
      .lean();

    const conversationMessages = priorMessages.map((m) => ({
      sender: m.sender,
      text: m.text,
      textEmotion: m.textEmotion,
      facialEmotion: m.facialEmotion,
    }));

    const sessionHistory = await EmotionLog.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(12)
      .select('userText textEmotion facialEmotion emotionSummary cognitiveDistortion contradictionDetected createdAt')
      .lean();

    const aiResult = await analyzeWithAI({
      text: text.trim(),
      imageBase64,
      sessionHistory,
      conversationMessages,
      userName: user?.name || 'User',
    });

    const userMessage = new Message({
      sessionId: session._id,
      sender: 'user',
      text: text.trim(),
      textEmotion: aiResult.textEmotion,
      facialEmotion: aiResult.facialEmotion,
      emotionSummary: aiResult.emotionSummary,
      cognitiveDistortion: aiResult.cognitiveDistortion,
    });
    await userMessage.save();

    const aiMessage = new Message({
      sessionId: session._id,
      sender: 'ai',
      text: aiResult.botResponse,
      aiSuggestion: aiResult.aiSuggestion,
    });
    await aiMessage.save();

    const emotionLog = new EmotionLog({
      userId: req.user.userId,
      sessionId: session._id,
      messageId: userMessage._id,
      userText: text.trim(),
      textEmotion: aiResult.textEmotion,
      facialEmotion: aiResult.facialEmotion,
      emotionSummary: aiResult.emotionSummary || `${aiResult.textEmotion} / ${aiResult.facialEmotion}`,
      combinedEmotion: aiResult.emotionSummary,
      sentimentLabel: aiResult.sentimentLabel,
      confidenceScore: aiResult.confidenceScore,
      severityScore: aiResult.severityScore,
      cognitiveDistortion: aiResult.cognitiveDistortion,
      contradictionDetected: aiResult.contradictionDetected,
      contradictionType: aiResult.contradictionType || null,
      actionUnits: aiResult.actionUnits,
    });
    await emotionLog.save();

    if (aiResult.cognitiveDistortion !== 'None') {
      session.moodSummary = aiResult.emotionSummary || aiResult.cognitiveDistortion;
      await session.save();
    }

    res.status(201).json({
      userMessage,
      aiMessage,
      emotionLog,
      metrics: buildMetrics(emotionLog, aiResult),
      safetyTriggered: aiResult.safetyTriggered,
      quickReplies: aiResult.quickReplies || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
