// Gemini API service — streams humanized responses; every token passes through voice sanitizer.
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { NEUROWELL_SYSTEM_PROMPT, buildGeminiContext } = require('./promptService');
const { buildHumanResponse, isValidGeminiKey } = require('./humanCompanion');
const { humanizeReply } = require('./voiceRules');

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!isValidGeminiKey(apiKey)) {
    throw new Error('Gemini API key is not configured');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    systemInstruction: NEUROWELL_SYSTEM_PROMPT,
  });
}

async function* streamGeminiResponse(contextPayload) {
  const model = getModel();
  const userContext = buildGeminiContext(contextPayload);

  const result = await model.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: userContext }] }],
  });

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

async function generateGeminiResponse(contextPayload) {
  let full = '';
  for await (const token of streamGeminiResponse(contextPayload)) {
    full += token;
  }
  return humanizeReply(full.trim());
}

async function* streamHumanResponse(contextPayload) {
  const response = humanizeReply(await buildHumanResponse(contextPayload));
  const words = response.split(/(\s+)/);
  for (const word of words) {
    if (word) yield word;
  }
}

async function generateHumanResponse(contextPayload) {
  return humanizeReply(await buildHumanResponse(contextPayload));
}

async function humanFallbackResponse(userText, textEmotion, cognitiveDistortion) {
  return humanizeReply(
    await buildHumanResponse({
      userText,
      textEmotion,
      cognitiveDistortion,
      conversationMessages: [],
      contradiction: { contradictionDetected: false },
    })
  );
}

module.exports = {
  streamGeminiResponse,
  generateGeminiResponse,
  streamHumanResponse,
  generateHumanResponse,
  humanFallbackResponse,
  isValidGeminiKey,
  humanizeReply,
};
