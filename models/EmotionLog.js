const mongoose = require("mongoose");

const emotionLogSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Session"
    },

    textEmotion: {
        type: String
    },

    facialEmotion: {
        type: String
    },

    severityScore: {
        type: Number
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("EmotionLog", emotionLogSchema);