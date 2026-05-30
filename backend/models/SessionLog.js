const mongoose = require('mongoose');

const SessionLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userText: { type: String, required: true },
  botResponse: { type: String, required: true },
  
  // Real-time Visual Engine tracking parameters
  detectedExpression: { type: String, default: 'Neutral' },
  actionUnits: { type: String, default: 'None' },
  
  // NLP Analytical tracking parameters
  cognitiveDistortion: { type: String, default: 'None' },
  contradictionDetected: { type: Boolean, default: false },
  
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SessionLog', SessionLogSchema);