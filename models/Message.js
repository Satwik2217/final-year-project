const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({

    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Session",
        required: true
    },

    sender: {
        type: String,
        enum: ["user", "ai"],
        required: true
    },

    text: {
        type: String,
        required: true
    },

    textEmotion: {
        type: String
    },

    facialEmotion: {
        type: String
    },

    aiSuggestion: {
        type: String
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Message", messageSchema);