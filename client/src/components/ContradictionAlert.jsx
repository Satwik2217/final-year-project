// Contradiction alert — softly appears when text emotion conflicts with facial emotion.
export default function ContradictionAlert({ visible, facialEmotion }) {
  if (!visible) return null;

  return (
    <div className="contradiction-alert">
      Your words and expression seem a little out of sync right now — that's completely okay.
      {facialEmotion && facialEmotion !== 'No Input' && (
        <span> Expression: <strong>{facialEmotion}</strong></span>
      )}
    </div>
  );
}
