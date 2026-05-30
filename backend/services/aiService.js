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
  const distortion = /always|never|everything|nothing/.test(lower)
    ? 'Overgeneralization / All-or-Nothing Thinking'
    : 'None';

  const name = userName && userName !== 'User' ? userName : 'there';

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
      ? `Hey ${name}, I'm really concerned about what you shared. Please reach out to Tele-MANAS at 14416 or iCall at 9152987821. You don't have to face this alone.`
      : `Thanks for sharing that, ${name}. I'm here with you — the AI engine is reconnecting, but your message is saved. Would you tell me a little more about how you're feeling right now?`,
    quickReplies: isCrisis
      ? ['I need help now', 'Tell me about helplines', "I'm not safe"]
      : ['I feel anxious', 'I had a rough day', 'Can we talk more?', "I'm not sure"],
    aiSuggestion: isCrisis ? 'Safety Escalation' : 'Supportive Listening',
    retrievedSourceId: 'fallback',
  };
}

module.exports = { analyzeWithAI };
