// Gemini API service — streams humanized responses; every token passes through voice sanitizer.
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { NEUROWELL_SYSTEM_PROMPT, buildGeminiContext } = require('./promptService');
const { buildHumanResponse, isValidGeminiKey } = require('./humanCompanion');
const { humanizeReply } = require('./voiceRules');

let geminiUnavailableUntil = 0;

function parseRetryDelay(value) {
  if (!value) return 0;
  const text = String(value).trim();
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) * 1000 : 0;
}

function getRetryDelay(error) {
  if (!error) return 0;
  if (error.retryDelay) {
    return parseRetryDelay(error.retryDelay);
  }
  if (error.retryInfo && error.retryInfo.retryDelay) {
    return parseRetryDelay(error.retryInfo.retryDelay);
  }
  if (Array.isArray(error.details)) {
    for (const detail of error.details) {
      if (detail.retryDelay) {
        return parseRetryDelay(detail.retryDelay);
      }
      if (detail['@type']?.includes('RetryInfo') && detail.retryDelay) {
        return parseRetryDelay(detail.retryDelay);
      }
    }
  }
  const message = String(error.message || '').toLowerCase();
  const match = message.match(/retry in (\d+(?:\.\d+)?)s/);
  if (match) {
    return Number(match[1]) * 1000;
  }
  return 60000;
}

function isGeminiAvailable() {
  return Date.now() >= geminiUnavailableUntil && isValidGeminiKey(process.env.GEMINI_API_KEY);
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!isValidGeminiKey(apiKey)) {
    throw new Error('Gemini API key is not configured');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction: NEUROWELL_SYSTEM_PROMPT,
  });
}

async function* streamGeminiResponse(contextPayload) {
  if (!isGeminiAvailable()) {
    throw new Error('Gemini unavailable: quota exceeded or API key not configured');
  }

  const model = getModel();
  const userContext = buildGeminiContext(contextPayload);

  try {
    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: userContext }] }],
    });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (error) {
    const message = String(error.message || '').toLowerCase();
    const isQuotaError = /quota|too many requests|rate limit|429/.test(message);
    if (isQuotaError) {
      geminiUnavailableUntil = Date.now() + getRetryDelay(error);
      console.warn('Gemini cooldown activated until', new Date(geminiUnavailableUntil).toISOString());
    }
    throw error;
  }
}

async function generateGeminiResponse(contextPayload) {
  if (!isGeminiAvailable()) {
    throw new Error('Gemini unavailable: quota exceeded or API key not configured');
  }

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
  isGeminiAvailable,
  humanizeReply,
};
