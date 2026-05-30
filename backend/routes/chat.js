const express = require('express');
const router = express.Router();
const SessionLog = require('../models/SessionLog'); 
const protect = require('../middleware/authMiddleware'); 

// 1. SAVE CHAT ENTRY: Securely links an individual exchange to the logged-in user
router.post('/log-message', protect, async (req, res) => {
  try {
    const { 
      userText, 
      botResponse, 
      detectedExpression, 
      actionUnits, 
      cognitiveDistortion, 
      contradictionDetected 
    } = req.body;

    // req.user.userId is pulled straight from the decrypted JWT token by the middleware
    const newChatEntry = new SessionLog({
      userId: req.user.userId, 
      userText,
      botResponse,
      detectedExpression,
      actionUnits,
      cognitiveDistortion,
      contradictionDetected
    });

    await newChatEntry.save();
    res.status(201).json({ message: "Chat interaction saved securely!", entry: newChatEntry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. FETCH HISTORY: Retrieves ONLY the active user's chat history data
router.get('/history', protect, async (req, res) => {
  try {
    // MongoDB filters out all entries that do not match this user's unique ID
    const userChats = await SessionLog.find({ userId: req.user.userId }).sort({ timestamp: -1 });
    
    res.status(200).json(userChats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;