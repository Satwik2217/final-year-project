// Contradiction detector — flags when text sentiment and facial emotion diverge in either direction.
const POSITIVE_TEXT = /\b(fine|okay|ok|good|great|happy|alright|nothing wrong|i'm good|im good|better|awesome)\b/i;
const NEGATIVE_TEXT = /\b(sad|upset|hurt|anxious|worried|depressed|lonely|angry|afraid|scared|bad|not okay|not fine|hopeless)\b/i;
const NEGATIVE_FACE = new Set(['sad', 'sadness', 'angry', 'anger', 'fear', 'fearful', 'disgust', 'contempt']);
const POSITIVE_FACE = new Set(['happy', 'happiness', 'surprise']);

const FACE_HUMAN = {
  sad: 'a little heavy-hearted',
  sadness: 'a little heavy-hearted',
  angry: 'tense or frustrated',
  anger: 'tense or frustrated',
  fear: 'on edge or anxious',
  fearful: 'on edge or anxious',
  disgust: 'uncomfortable',
  neutral: 'quiet and guarded',
};

function detectContradiction(text, facialEmotion) {
  const faceKey = (facialEmotion || '').toLowerCase();
  const positiveText = POSITIVE_TEXT.test(text);
  const negativeText = NEGATIVE_TEXT.test(text);
  const negativeFace = NEGATIVE_FACE.has(faceKey);
  const positiveFace = POSITIVE_FACE.has(faceKey);

  const textPositiveFaceNegative = positiveText && negativeFace;
  const textNegativeFacePositive = negativeText && positiveFace;
  const detected = textPositiveFaceNegative || textNegativeFacePositive;
  const contradictionType = textPositiveFaceNegative
    ? 'text_positive_face_negative'
    : textNegativeFacePositive
      ? 'text_negative_face_positive'
      : null;

  return {
    contradictionDetected: detected,
    contradictionType,
    detectedEmotions: detected
      ? {
          text_emotion_human: textPositiveFaceNegative ? 'okay or fine' : 'low or upset',
          facial_emotion_human: FACE_HUMAN[faceKey] || 'not quite matching your words',
        }
      : {},
  };
}

module.exports = { detectContradiction };
