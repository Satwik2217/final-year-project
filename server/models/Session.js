// Mongoose Session model — each chat session belongs to one authenticated user.
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New Session' },
    lastEmotion: { type: String, default: 'Balanced' },
    lastDistortion: { type: String, default: 'None' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
