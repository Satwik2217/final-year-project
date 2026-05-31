// Mongoose Message model — stores user/AI messages with emotion and distortion metadata.
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sender: { type: String, enum: ['user', 'ai'], required: true },
    text: { type: String, required: true },
    textEmotion: { type: String, default: 'Balanced' },
    facialEmotion: { type: String, default: 'No Input' },
    actionUnits: { type: String, default: 'None' },
    cognitiveDistortion: { type: String, default: 'None' },
    contradictionDetected: { type: Boolean, default: false },
    emotionSummary: { type: String, default: '' },
    ragSourceId: { type: String, default: '' },
    techniqueUsed: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
