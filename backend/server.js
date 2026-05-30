// 1. FORCE NODE TO BYPASS ISP DNS BLOCKS
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Import Routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');

// Connect to MongoDB Atlas Cloud
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
  .then(() => console.log("Successfully synched with MongoDB Atlas Cloud!"))
  .catch((err) => console.error("Database connection fault:", err));

// Link Routes to URL endpoints
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Simple baseline test route
app.get('/api/test', (req, res) => {
  res.json({ message: "NeuroWell backend engine online!" });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running smoothly on port ${PORT}`));