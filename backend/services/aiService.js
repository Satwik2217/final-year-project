const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function analyzeWithAI({ text, imageBase64, sessionHistory = [] }) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        image_base64: imageBase64 || null,
        session_history: sessionHistory,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI service unavailable, using fallback:', error.message);
    return fallbackAnalysis(text);
  }
}

function fallbackAnalysis(text) {
  const lower = text.toLowerCase();
  const isCrisis = /suicid|kill myself|end my life|want to die/i.test(text);
  const distortion = /always|never|everything|nothing/.test(lower)
    ? 'Overgeneralization / All-or-Nothing Thinking'
    : 'None';

  return {
    textEmotion: /sad|anxious|stress|worried/.test(lower) ? 'Distress Detected' : 'Balanced',
    facialEmotion: 'No Input',
    actionUnits: 'None',
    cognitiveDistortion: distortion,
    contradictionDetected: false,
    contradictionMessage: '',
    riskLevel: isCrisis ? 'high' : 'low',
    severityScore: isCrisis ? 10 : 0,
    safetyTriggered: isCrisis,
    safetyStatus: isCrisis ? 'Alert' : 'Secure',
    botResponse: isCrisis
      ? 'Please reach out to Tele-MANAS at 14416 or iCall at 9152987821. You do not have to face this alone.'
      : 'Thank you for sharing. NeuroWell AI engine is reconnecting — your message has been saved.',
    aiSuggestion: isCrisis ? 'Safety Escalation' : 'Supportive Listening',
    retrievedSourceId: 'fallback',
  };
}

module.exports = { analyzeWithAI };
