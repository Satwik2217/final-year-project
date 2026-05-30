const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Added for password hashing
const jwt = require('jsonwebtoken');   // Added for token generation
const User = require('../models/User');

// Use an environment variable for your JWT secret, or a fallback for local development
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

// COUNTER 1: User Registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if the user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered!" });
    }

    // Hash the password before saving it to the database
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create and save the new user record with the hashed password
    const newUser = new User({ 
      name, 
      email, 
      password: hashedPassword 
    });
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
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Compare the incoming plain text password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate a JWT token valid for 1 hour
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Return the token along with user details
    res.status(200).json({ 
      message: "Login successful!", 
      token, // Send this token back to the client
      user: { id: user._id, name: user.name, email: user.email } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;