// Crisis modal — shown when safety layer detects self-harm language.
export default function CrisisModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="crisis-overlay" onClick={onClose}>
      <div className="crisis-modal" onClick={(e) => e.stopPropagation()}>
        <h3>You matter — please reach out</h3>
        <p style={{ lineHeight: 1.6, marginBottom: '1rem' }}>
          What you shared is important. You don't have to face this alone.
        </p>
        <ul style={{ lineHeight: 2, marginBottom: '1.5rem', paddingLeft: '1.2rem' }}>
          <li><strong>iCall India:</strong> 9152987821</li>
          <li><strong>Vandrevala Foundation:</strong> 1860-2662-345</li>
          <li><strong>Tele-MANAS:</strong> 14416</li>
        </ul>
        <button
          onClick={onClose}
          style={{ background: 'var(--danger)', color: '#fff', padding: '10px 20px', borderRadius: 10 }}
        >
          I understand
        </button>
      </div>
    </div>
  );
}
