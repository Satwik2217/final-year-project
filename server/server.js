// Express.js entry point — connects MongoDB, mounts auth/chat/analytics routes on port 5000.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const analyticsRoutes = require('./routes/analytics');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));

if (!isDev) {
  const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
}

app.get('/health', (_req, res) => {
  res.json({ status: 'online', service: 'NeuroWell API', port: PORT });
});

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/analytics', analyticsRoutes);

if (!isDev) {
  const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

async function start() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/neurowell';
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');

    const { DEEPFACE_URL } = require('./services/deepfaceClient');
    try {
      const axios = require('axios');
      await axios.get(`${DEEPFACE_URL}/health`, { timeout: 3000 });
      console.log(`DeepFace API online at ${DEEPFACE_URL}`);
    } catch {
      console.warn(`⚠ DeepFace not reachable at ${DEEPFACE_URL} — will use Python CLI fallback for live emotion`);
    }

    app.listen(PORT, () => console.log(`NeuroWell server running on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
