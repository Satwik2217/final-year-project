// Shared NeuroWell voice rules — strips robotic phrasing from any generated reply.
const ROBOTIC_OPENERS = [
  /^Certainly[!.,]?\s*/i,
  /^Of course[!.,]?\s*/i,
  /^Sure[!.,]?\s*/i,
  /^Absolutely[!.,]?\s*/i,
  /^Great question[!.,]?\s*/i,
  /^I understand[!.,]?\s*/i,
  /^As an AI[^.]*\.\s*/i,
  /^I'm an AI[^.]*\.\s*/i,
  /^I am an AI[^.]*\.\s*/i,
  /^As a language model[^.]*\.\s*/i,
  /^I am here to help[^.]*\.\s*/i,
  /^I'm here to help[^.]*\.\s*/i,
];

const FORBIDDEN_PHRASES = [
  /add (a |an |your )?(gemini|api) key/gi,
  /try rephrasing/gi,
  /I am limited/gi,
  /I'm limited/gi,
  /environment variable/gi,
  /model name/gi,
  /internal (system|config)/gi,
];

function humanizeReply(text) {
  if (!text) return text;
  let cleaned = text.trim();

  for (let i = 0; i < 4; i += 1) {
    let changed = false;
    for (const pattern of ROBOTIC_OPENERS) {
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(pattern, '').trim();
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const pattern of FORBIDDEN_PHRASES) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

module.exports = { humanizeReply, ROBOTIC_OPENERS, FORBIDDEN_PHRASES };
