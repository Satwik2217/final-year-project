const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Message = require('../models/Message');
const EmotionLog = require('../models/EmotionLog');
const protect = require('../middleware/authMiddleware');
const { analyzeWithAI } = require('../services/aiService');

function buildMetrics(emotionLog, aiResult) {
  return {
    detectedExpression: aiResult?.textEmotion || emotionLog.textEmotion,
    actionUnits: aiResult?.actionUnits || emotionLog.actionUnits || 'None',
    cognitiveDistortion: aiResult?.cognitiveDistortion || emotionLog.cognitiveDistortion,
    contradictionDetected: aiResult?.contradictionDetected ?? emotionLog.contradictionDetected,
    safetyStatus: aiResult?.safetyStatus || (emotionLog.severityScore >= 8 ? 'Alert' : 'Secure'),
    safetyTriggered: aiResult?.safetyTriggered || false,
    facialEmotion: aiResult?.facialEmotion || emotionLog.facialEmotion,
    visionEngine: aiResult?.visionEngine || 'None',
  };
}

router.post('/', protect, async (req, res) => {
  try {
    const session = new Session({
      userId: req.user.userId,
      sessionTitle: req.body.sessionTitle || 'Therapy Session',
    });
    await session.save();

    const welcome = new Message({
      sessionId: session._id,
      sender: 'ai',
      text: 'Hello! Welcome back to NeuroWell. I have access to your longitudinal emotional profile. How are you feeling today?',
    });
    await welcome.save();

    res.status(201).json({ session, messages: [welcome] });
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

    const sessionHistory = await EmotionLog.find({ userId: req.user.userId, sessionId: session._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const aiResult = await analyzeWithAI({
      text: text.trim(),
      imageBase64,
      sessionHistory,
    });

    const userMessage = new Message({
      sessionId: session._id,
      sender: 'user',
      text: text.trim(),
      textEmotion: aiResult.textEmotion,
      facialEmotion: aiResult.facialEmotion,
    });
    await userMessage.save();

    const aiMessage = new Message({
      sessionId: session._id,
      sender: 'ai',
      text: aiResult.botResponse,
      aiSuggestion: `${aiResult.aiSuggestion} (RAG: ${aiResult.retrievedSourceId})`,
    });
    await aiMessage.save();

    const emotionLog = new EmotionLog({
      userId: req.user.userId,
      sessionId: session._id,
      messageId: userMessage._id,
      textEmotion: aiResult.textEmotion,
      facialEmotion: aiResult.facialEmotion,
      severityScore: aiResult.severityScore,
      cognitiveDistortion: aiResult.cognitiveDistortion,
      contradictionDetected: aiResult.contradictionDetected,
    });
    emotionLog.actionUnits = aiResult.actionUnits;
    await emotionLog.save();

    if (aiResult.cognitiveDistortion !== 'None') {
      session.moodSummary = aiResult.cognitiveDistortion;
      await session.save();
    }

    res.status(201).json({
      userMessage,
      aiMessage,
      emotionLog,
      metrics: buildMetrics(emotionLog, aiResult),
      safetyTriggered: aiResult.safetyTriggered,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
