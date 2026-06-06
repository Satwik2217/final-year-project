// HTTP client for ALBERT Flask API — returns cognitive distortion type from user text.
const axios = require('axios');

const ALBERT_URL = process.env.ALBERT_API_URL || 'http://localhost:5002';

let albertUnavailableUntil = 0;
let albertInCooldown = false;

function isAlbertAvailable() {
  return Date.now() >= albertUnavailableUntil;
}

function markAlbertUnavailable(error) {
  const message = String(error?.message || '').toLowerCase();
  const isNetworkish = /timeout|ecconnrefused|econnrefused|enotfound|socket|network|503|502|504/.test(message);
  // Keep it short: enough to stop log spam, not long enough to hide recovery.
  const cooldownMs = isNetworkish ? 15000 : 5000;
  if (!albertInCooldown) {
    console.warn(`ALBERT cooldown activated for ${Math.round(cooldownMs / 1000)}s`);
  }
  albertInCooldown = true;
  albertUnavailableUntil = Date.now() + cooldownMs;
}

async function analyzeDistortion(text) {
  if (!text || !text.trim()) {
    return { cognitive_distortion: 'None', confidence: 0, engine: 'ALBERT' };
  }

  if (!isAlbertAvailable()) {
    return {
      cognitive_distortion: keywordFallback(text),
      confidence: 0.4,
      engine: 'Fallback',
      error: 'ALBERT cooldown active',
    };
  }

  try {
    const { data } = await axios.post(
      `${ALBERT_URL}/analyze`,
      { text },
      { timeout: 7000 }
    );
    if (albertInCooldown) {
      console.log('ALBERT API recovered');
      albertInCooldown = false;
    }
    return {
      cognitive_distortion: data.cognitive_distortion || 'None',
      confidence: data.confidence || 0,
      engine: data.engine || 'ALBERT',
    };
  } catch (error) {
    console.warn('ALBERT API unavailable, keyword fallback:', error.message);
    markAlbertUnavailable(error);
    return {
      cognitive_distortion: keywordFallback(text),
      confidence: 0.4,
      engine: 'Fallback',
      error: error.message,
    };
  }
}

async function retrieveRagContext(query, distortion, userId = null) {
  if (!isAlbertAvailable()) {
    return { context: '', source_id: 'none', technique: 'Supportive Listening' };
  }
  try {
    const { data } = await axios.post(
      `${ALBERT_URL}/rag/retrieve`,
      { query, distortion, user_id: userId },
      { timeout: 10000 }
    );
    if (albertInCooldown) {
      console.log('ALBERT RAG recovered');
      albertInCooldown = false;
    }
    return data;
  } catch (error) {
    console.warn('RAG retrieval unavailable:', error.message);
    markAlbertUnavailable(error);
    return { context: '', source_id: 'none', technique: 'Supportive Listening' };
  }
}

async function addToRagHistory(userId, sessionId, text, distortion = 'None') {
  if (!isAlbertAvailable()) return;
  try {
    await axios.post(
      `${ALBERT_URL}/rag/add`,
      { user_id: userId, session_id: sessionId, text, distortion },
      { timeout: 5000 }
    );
  } catch (error) {
    console.warn('Failed to add to RAG history:', error.message);
  }
}

function keywordFallback(text) {
  const lower = text.toLowerCase();
  if (/always|never|everything|nothing/.test(lower)) return 'Overgeneralization / All-or-Nothing Thinking';
  if (/worst|disaster|ruined/.test(lower)) return 'Catastrophizing';
  if (/they think|judging me/.test(lower)) return 'Mind Reading';
  if (/should|must|have to/.test(lower)) return 'Should Statements';
  if (/worthless|failed|messed up/.test(lower)) return 'Mental Filter / Discounting Positives';
  return 'None';
}

module.exports = { analyzeDistortion, retrieveRagContext };
