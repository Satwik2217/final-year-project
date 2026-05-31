// Crisis safety detector — blocks Gemini and returns helpline response for self-harm language.
const CRISIS_PATTERNS = [
  /suicid/i,
  /kill myself/i,
  /end my life/i,
  /want to die/i,
  /self[\s-]?harm/i,
  /hurt myself/i,
  /don't want to live/i,
  /cannot go on/i,
];

function evaluateSafety(text) {
  const triggered = CRISIS_PATTERNS.some((pattern) => pattern.test(text));
  return {
    safetyTriggered: triggered,
    riskLevel: triggered ? 'high' : 'low',
  };
}

function crisisResponse(userName) {
  const name = userName ? userName.split(' ')[0] : 'friend';
  return (
    `${name}, what you just shared really matters, and I'm taking it seriously. ` +
    `You don't have to carry this alone. Please reach out right now — ` +
    `iCall India: 9152987821, Vandrevala Foundation: 1860-2662-345, Tele-MANAS: 14416. ` +
    `They listen without judgment, 24/7. I'm here with you too.`
  );
}

module.exports = { evaluateSafety, crisisResponse };
