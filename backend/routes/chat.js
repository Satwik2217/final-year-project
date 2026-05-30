const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const SessionLog = require('../models/SessionLog');

// API GATEWAY: Processes text through the real BERT Python AI model
router.post('/analyze', async (req, res) => {
  const { userId, userText } = req.body;

  if (!userText) {
    return res.status(400).json({ error: "No text provided for analysis." });
  }

  // Define the exact path to your Python script inside the ai_engine folder
  const scriptPath = path.join(__dirname, '../../ai_engine/text_brain.py');

  // Spawn a background system process to execute: py text_brain.py "userText"
  const pythonProcess = spawn('py', [scriptPath, userText]);

  let aiDataStr = '';

  // Gather the data text stream flowing out of Python's output
  pythonProcess.stdout.on('data', (data) => {
    aiDataStr += data.toString();
  });

  // Handle data collection completion
  pythonProcess.on('close', async (code) => {
    try {
      // Clean up any stray spaces or invisible line breaks from Python's terminal output
      const cleanData = aiDataStr.trim();

      if (!cleanData) {
        throw new Error("Python script returned an empty output stream.");
      }

      // FIXED: Direct parse since Python is now outputting ONLY the clean raw JSON string
      const parsedAIResult = JSON.parse(cleanData);

      // Create an empathetic therapeutic response baseline dynamically based on BERT analysis values
      let botTherapyResponse = "Thank you for sharing that with me. I've noted down your emotional baseline state.";
      
      if (parsedAIResult.cognitiveDistortion !== "None") {
        botTherapyResponse = `I notice some patterns of "${parsedAIResult.cognitiveDistortion}" in your statement. Let's look at this closely together. Is it absolutely true that things always happen this way?`;
      } else if (parsedAIResult.sentiment_label === "NEGATIVE") {
        botTherapyResponse = "It sounds like you're carrying a heavy weight right now. I'm here to listen. Can you tell me more about what's bringing up these feelings?";
      }

      // Automatically store this real interaction into your MongoDB Atlas Cloud database
      const newLog = new SessionLog({
        userId: userId || "000000000000000000000000", // Fallback if no user is logged in
        userText: userText,
        botResponse: botTherapyResponse,
        detectedExpression: parsedAIResult.sentiment_label === "NEGATIVE" ? "Distressed" : "Stable Mood",
        cognitiveDistortion: parsedAIResult.cognitiveDistortion,
        contradictionDetected: false
      });
      await newLog.save();

      // Return the combined AI metrics and text back up to React!
      res.status(200).json({
        botResponse: botTherapyResponse,
        aiMetrics: parsedAIResult
      });

    } catch (err) {
      console.error("Bridge Error:", err);
      res.status(500).json({ 
        error: "Failed to process text through the AI neural model layer.", 
        details: aiDataStr 
      });
    }
  });
});

// Older logging paths kept functional just in case
router.post('/log', async (req, res) => {
  try {
    const newLog = new SessionLog(req.body);
    await newLog.save();
    res.status(201).json({ message: "Saved successfully", log: newLog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;