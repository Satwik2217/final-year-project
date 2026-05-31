const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function analyzeWithAI({ text, imageBase64, sessionHistory = [], conversationMessages = [], userName = 'User' }) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        image_base64: imageBase64 || null,
        session_history: sessionHistory,
        conversation_messages: conversationMessages,
        user_name: userName,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI service unavailable, using fallback:', error.message);
    return fallbackAnalysis(text, userName);
  }
}

function fallbackAnalysis(text, userName) {
  const lower = text.toLowerCase();
  const isCrisis = /suicid|kill myself|end my life|want to die/i.test(text);
  const isDistress = /sad|anxious|stress|worried|overwhelm|lonely|hurt|depressed/i.test(lower);
  const isFactual = /\b(what is|what's|who is|where is|capital of|how does|explain|tell me about)\b/i.test(text) || text.trim().endsWith('?');
  const distortion = /always|never|everything|nothing/.test(lower)
    ? 'Overgeneralization / All-or-Nothing Thinking'
    : 'None';

  let textEmotion = 'Balanced';
  if (isDistress) textEmotion = 'Distress Detected';
  else if (/happy|good|better|grateful/.test(lower)) textEmotion = 'Positive';

  let botResponse;
  const facts = {
    'capital of usa': "Washington, D.C. — it's been the U.S. capital since 1800.",
    'capital of india': 'New Delhi — seat of all three branches of government.',
    'capital of france': 'Paris — yeah, that one.',
  };

  if (isCrisis) {
    botResponse =
      "What you shared is really important, and I'm taking it seriously. You matter. Please call iCall: 9152987821 or Tele-MANAS: 14416.";
  } else if (isFactual) {
    const factKey = Object.keys(facts).find((k) => lower.includes(k));
    botResponse = factKey
      ? facts[factKey]
      : "Good question — the AI engine is offline right now. Start the Python service on port 8000 (with GEMINI_API_KEY for full answers).";
  } else if (isDistress) {
    botResponse =
      "That sounds really tough — and it makes complete sense that you'd feel this way. I'm here with you. What's weighing on you most right now?";
  } else if (distortion !== 'None') {
    botResponse =
      "I'm noticing some absolute thinking in what you said — want to explore if there might be any exceptions? I'm listening.";
  } else {
    botResponse = "I hear you. Tell me more — what's behind that feeling?";
  }

  return {
    textEmotion,
    facialEmotion: 'No Input',
    actionUnits: 'None',
    cognitiveDistortion: distortion,
    contradictionDetected: false,
    contradictionMessage: '',
    emotionSummary: `Text: ${textEmotion.toLowerCase()}`,
    riskLevel: isCrisis ? 'high' : 'low',
    severityScore: isCrisis ? 10 : isDistress ? 5 : 0,
    safetyTriggered: isCrisis,
    safetyStatus: isCrisis ? 'Alert' : 'Secure',
    botResponse,
    quickReplies: isDistress
      ? ['I feel overwhelmed', 'I just need someone to listen', "It's about work"]
      : ['Tell me more', "I'm not sure how I feel"],
    aiSuggestion: isCrisis ? 'Safety Escalation' : 'Emotion-First Support',
    retrievedSourceId: 'fallback',
    sentimentLabel: isDistress ? 'NEGATIVE' : 'NEUTRAL',
    confidenceScore: 0.5,
  };
}

module.exports = { analyzeWithAI };
