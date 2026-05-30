const express = require('express');
const router = express.Router();
const User = require('../models/User');

// COUNTER 1: User Registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if the user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered!" });
    }

    // Create and save the new user record
    const newUser = new User({ name, email, password });
    await newUser.save();

    res.status(201).json({ message: "Registration successful!", userId: newUser._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// COUNTER 2: User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Search for user by email
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    res.status(200).json({ message: "Login successful!", userId: user._id, name: user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;