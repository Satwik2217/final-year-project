// Analytics routes — emotion history and trend data for the Recharts dashboard.
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const EmotionLog = require('../models/EmotionLog');

const router = express.Router();

const EMOTION_SCORE = {
  Positive: 4,
  Balanced: 3,
  'Mild Negative': 2,
  'Distress Detected': 1,
};

router.use(authMiddleware);

router.get('/emotions', async (req, res) => {
  try {
    const logs = await EmotionLog.find({ userId: req.user.id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    const trend = logs.map((log) => ({
      date: log.createdAt,
      textEmotion: log.textEmotion,
      facialEmotion: log.facialEmotion,
      cognitiveDistortion: log.cognitiveDistortion,
      contradictionDetected: log.contradictionDetected,
      score: EMOTION_SCORE[log.textEmotion] ?? 3,
      emotionSummary: log.emotionSummary,
    }));

    res.json({ trend, total: trend.length });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Could not load emotion history' });
  }
});

module.exports = router;
