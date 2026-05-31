const mongoose = require('mongoose');

const emotionLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  userText: {
    type: String,
  },
  textEmotion: {
    type: String,
    default: 'pending',
  },
  facialEmotion: {
    type: String,
    default: 'pending',
  },
  emotionSummary: {
    type: String,
  },
  combinedEmotion: {
    type: String,
  },
  sentimentLabel: {
    type: String,
  },
  confidenceScore: {
    type: Number,
  },
  severityScore: {
    type: Number,
    default: 0,
  },
  actionUnits: {
    type: String,
    default: 'None',
  },
  cognitiveDistortion: {
    type: String,
    default: 'None',
  },
  contradictionDetected: {
    type: Boolean,
    default: false,
  },
  contradictionType: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('EmotionLog', emotionLogSchema);
