// Mongoose EmotionLog model — longitudinal emotion/distortion history per user for memory.
const mongoose = require('mongoose');

const emotionLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    userText: { type: String, default: '' },
    textEmotion: { type: String, default: 'Balanced' },
    facialEmotion: { type: String, default: 'No Input' },
    actionUnits: { type: String, default: 'None' },
    cognitiveDistortion: { type: String, default: 'None' },
    contradictionDetected: { type: Boolean, default: false },
    emotionSummary: { type: String, default: '' },
    aiResponse: { type: String, default: '' },
    techniqueUsed: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmotionLog', emotionLogSchema);
