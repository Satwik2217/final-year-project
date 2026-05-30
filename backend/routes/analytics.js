const express = require('express');
const router = express.Router();
const EmotionLog = require('../models/EmotionLog');
const protect = require('../middleware/authMiddleware');

router.get('/emotion-history', protect, async (req, res) => {
  try {
    const logs = await EmotionLog.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('textEmotion facialEmotion cognitiveDistortion severityScore contradictionDetected createdAt');

    res.json(logs.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', protect, async (req, res) => {
  try {
    const logs = await EmotionLog.find({ userId: req.user.userId });
    const totalSessions = await require('../models/Session').countDocuments({ userId: req.user.userId });
    const contradictions = logs.filter((log) => log.contradictionDetected).length;
    const highRisk = logs.filter((log) => log.severityScore >= 8).length;

    res.json({
      totalInteractions: logs.length,
      totalSessions,
      contradictionsDetected: contradictions,
      safetyAlerts: highRisk,
      commonDistortion: getMostCommon(logs.map((l) => l.cognitiveDistortion)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getMostCommon(items) {
  const counts = {};
  items.forEach((item) => {
    if (item && item !== 'None') counts[item] = (counts[item] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'None';
}

module.exports = router;
