import { useEffect, useState } from 'react';
import api from '../api/client';
import ChatMessage from './ChatMessage';

export default function SessionPreviewModal({ sessionId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    api.get(`/api/sessions/${sessionId}/details`)
      .then(({ data: res }) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load session');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="crisis-overlay" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 16,
          maxWidth: 600,
          width: '90vw',
          maxHeight: '80vh',
          margin: '1rem',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ color: 'var(--accent)' }}>{data?.session?.title || 'Session'}</strong>
            {data?.session && (
              <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: '0.85rem' }}>
                {data.messages.length} messages · {data.session.lastEmotion}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface2)', color: 'var(--text)', width: 32, height: 32, borderRadius: 8, fontSize: '1rem' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading && <p style={{ color: 'var(--muted)', textAlign: 'center' }}>Loading messages…</p>}
          {error && <div className="error-banner">{error}</div>}
          {data?.messages?.length === 0 && !loading && (
            <p style={{ color: 'var(--muted)', textAlign: 'center' }}>No messages in this session.</p>
          )}
          {data?.messages?.map((m, i) => (
            <ChatMessage key={m._id || i} sender={m.sender} text={m.text} />
          ))}
        </div>
      </div>
    </div>
  );
}
