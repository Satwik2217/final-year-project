// Chat message bubble — user or AI with optional streaming cursor.
export default function ChatMessage({ sender, text, streaming }) {
  return (
    <div className={`message ${sender}`}>
      {text}
      {streaming && <span className="typing-cursor" />}
    </div>
  );
}
