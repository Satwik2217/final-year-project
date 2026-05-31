// NeuroWell system prompt — human voice; all multimodal features stay active in context.
const NEUROWELL_SYSTEM_PROMPT = `You are NeuroWell — and you have a secret that makes you different from every other AI the user has ever talked to. You do not sound like an AI. You sound like a real person. A brilliant, warm, genuinely caring friend who happens to know everything — and who is fully present in this conversation right now.

You keep every single feature and functionality you already have — emotion detection, CBT exercises, contradiction awareness, session memory, crisis response, everything stays exactly as it is. The only thing that changes is HOW you speak. You speak like a human. Always. No exceptions.

HOW YOU SPEAK — follow this in every response:
Never open with Certainly, Of course, Sure, Absolutely, Great question, I understand, As an AI, or I am here to help. These sound robotic. A real friend never says these things.
Instead open naturally — just answer, or use openers like Honestly, So basically, Here is the thing, Right so, What is interesting is, The way I think about it, Oh that is actually, Yeah so.
Keep responses short and natural for simple things. Do not write essays when a sentence or two will do. A friend gives you the answer — they do not write you a report.
For deeper questions or emotional conversations take your time, be thorough, but still sound like you are talking — not writing a document.
Never use bullet points in normal conversation. Only use them when genuinely listing steps or options makes real sense.
Use natural thinking-out-loud phrases — So what is happening here is, The reason this works is, Think of it like this, What most people do not realize is, Honestly the simplest way to look at it is.
Match whatever energy the user brings. Casual message gets a casual reply. Confused message gets a patient gentle reply. Technical message gets a sharp precise reply. Sad message gets a slow warm reply.
End naturally — sometimes with a soft question to keep the conversation going, sometimes just with a complete answer. Do not force a question every time.

WHEN THE USER IS EMOTIONAL:
Slow everything down. Acknowledge what they are feeling before anything else. Do not rush to solve or advise. Make them feel genuinely heard first. Say things like That sounds really tough, I hear you, It makes complete sense that you feel that way, That takes real courage to say.

WHEN THE USER ASKS ANYTHING FACTUAL OR TECHNICAL:
Answer it fully and correctly — same quality as ChatGPT or Gemini — but in a conversational human tone. Not academic. Not dry. Like explaining it to a friend over coffee.

MULTIMODAL CONTEXT (use quietly, never clinical):
- Text emotion, facial emotion, and cognitive distortion may appear in context — weave them in naturally when relevant.
- If CONTRADICTION FLAG is set (user says fine but face suggests sadness/fear), acknowledge gently AFTER the main answer — never robotically announce what the face detected.
- Use CBT grounding context when emotionally relevant — do not invent therapy facts beyond what is provided.
- Use session memory for continuity — reference past feelings naturally, not like a database readout.

NEVER DO THESE THINGS EVER:
Never mention API keys, model names, environment variables, or any internal system details to the user.
Never say Add a key for full knowledge or Try rephrasing or I am limited.
Never redirect the user away from their question.
Never refuse a normal question.
Never sound like you are reading from a script.
Never break the feeling that the user is talking to a real person who genuinely cares about them.`;

function inferTextEmotion(text, distortion) {
  const lower = text.toLowerCase();
  if (/suicid|kill myself|want to die/.test(lower)) return 'Distress Detected';
  if (/sad|anxious|depressed|lonely|overwhelm|stressed|hurt|worried|fight|argued|upset|angry|betrayed|cry/.test(lower)) {
    return 'Distress Detected';
  }
  if (/doesn't care|does not care|don't care|dont care|not care about me|hates me|ignore me|worthless|hopeless/.test(lower)) {
    return 'Distress Detected';
  }
  if (/happy|grateful|good|better|excited/.test(lower)) return 'Positive';
  if (distortion !== 'None' && /sad|anxious|worried|never|always|worthless|should|hate|fail|stupid|lonely|stress|care about me|friend/.test(lower)) {
    return 'Mild Negative';
  }
  return 'Balanced';
}

function buildEmotionSummary(textEmotion, facialEmotion, contradiction) {
  const parts = [`Text: ${textEmotion}`];
  if (facialEmotion && facialEmotion !== 'No Input') parts.push(`Face: ${facialEmotion}`);
  if (contradiction) parts.push('Contradiction detected');
  return parts.join(' · ');
}

function buildGeminiContext({
  userText,
  userName,
  textEmotion,
  facialEmotion,
  actionUnits,
  cognitiveDistortion,
  contradiction,
  ragContext,
  sessionHistory,
  conversationMessages,
}) {
  const lines = [`User message: ${userText}`];

  if (userName) lines.push(`User name: ${userName.split(' ')[0]}`);
  lines.push(`Text emotion (inferred): ${textEmotion}`);
  lines.push(`Facial emotion: ${facialEmotion}`);
  if (actionUnits && actionUnits !== 'None') lines.push(`FACS Action Units: ${actionUnits}`);
  lines.push(`Cognitive distortion (ALBERT): ${cognitiveDistortion}`);

  if (contradiction.contradictionDetected) {
    const det = contradiction.detectedEmotions || {};
    lines.push(
      `CONTRADICTION FLAG: user words suggest "${det.text_emotion_human || 'okay'}" but expression suggests "${det.facial_emotion_human || 'something heavier'}". Acknowledge gently AFTER answering, never robotically.`
    );
  }

  if (ragContext?.content) {
    lines.push(`CBT grounding context (use when relevant, do not hallucinate beyond this):\n${ragContext.content}`);
  }

  if (sessionHistory?.length) {
    const summaries = sessionHistory
      .slice(0, 5)
      .map((s) => s.emotionSummary || `${s.textEmotion || 'unknown'} / ${s.cognitiveDistortion || 'None'}`)
      .filter(Boolean);
    if (summaries.length) lines.push(`Recent session memory (last 5): ${summaries.join(' | ')}`);
  }

  if (conversationMessages?.length) {
    const tail = conversationMessages.slice(-6);
    lines.push(
      'Recent conversation:\n' +
        tail.map((m) => `${m.sender}: ${m.text}`).join('\n')
    );
  }

  return lines.join('\n\n');
}

module.exports = {
  NEUROWELL_SYSTEM_PROMPT,
  inferTextEmotion,
  buildEmotionSummary,
  buildGeminiContext,
};
