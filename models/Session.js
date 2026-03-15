const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    sessionTitle: {
        type: String,
        default: "Therapy Session"
    },

    moodSummary: {
        type: String
    },

    startedAt: {
        type: Date,
        default: Date.now
    },

    endedAt: {
        type: Date
    }

});

module.exports = mongoose.model("Session", sessionSchema);