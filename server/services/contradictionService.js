// Contradiction detector — flags when positive text conflicts with negative facial emotion.
const POSITIVE_TEXT = /\b(fine|okay|ok|good|great|happy|alright|nothing wrong|i'm good|im good)\b/i;
const NEGATIVE_FACE = new Set(['sad', 'sadness', 'angry', 'anger', 'fear', 'fearful', 'disgust', 'contempt']);

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
  const negativeFace = NEGATIVE_FACE.has(faceKey);

  const detected = positiveText && negativeFace;

  return {
    contradictionDetected: detected,
    contradictionType: detected ? 'text_positive_face_negative' : null,
    detectedEmotions: detected
      ? {
          text_emotion_human: 'okay or fine',
          facial_emotion_human: FACE_HUMAN[faceKey] || 'not quite matching your words',
        }
      : {},
  };
}

module.exports = { detectContradiction };
