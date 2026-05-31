// HTTP client for ALBERT Flask API — returns cognitive distortion type from user text.
const axios = require('axios');

const ALBERT_URL = process.env.ALBERT_API_URL || 'http://localhost:5002';

async function analyzeDistortion(text) {
  if (!text || !text.trim()) {
    return { cognitive_distortion: 'None', confidence: 0, engine: 'ALBERT' };
  }

  try {
    const { data } = await axios.post(
      `${ALBERT_URL}/analyze`,
      { text },
      { timeout: 5000 }
    );
    return {
      cognitive_distortion: data.cognitive_distortion || 'None',
      confidence: data.confidence || 0,
      engine: data.engine || 'ALBERT',
    };
  } catch (error) {
    console.warn('ALBERT API unavailable, keyword fallback:', error.message);
    return {
      cognitive_distortion: keywordFallback(text),
      confidence: 0.4,
      engine: 'Fallback',
      error: error.message,
    };
  }
}

async function retrieveRagContext(query, distortion) {
  try {
    const { data } = await axios.post(
      `${ALBERT_URL}/rag/retrieve`,
      { query, distortion },
      { timeout: 5000 }
    );
    return data;
  } catch (error) {
    console.warn('RAG retrieval unavailable:', error.message);
    return { content: '', source_id: 'none', technique: 'Supportive Listening', source_ids: [] };
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
