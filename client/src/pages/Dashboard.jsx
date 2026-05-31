// Main dashboard — chat with Gemini streaming, webcam, CBT cards, and emotion history.
import { useCallback, useEffect, useRef, useState } from 'react';
import api, { getStoredUser, setAuthToken } from '../api/client';
import ChatMessage from '../components/ChatMessage';
import WebcamPanel from '../components/WebcamPanel';
import CBTExerciseCard from '../components/CBTExerciseCard';
import ContradictionAlert from '../components/ContradictionAlert';
import MoodChart from '../components/MoodChart';
import CrisisModal from '../components/CrisisModal';

export default function Dashboard() {
  const user = getStoredUser();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [streamingText, setStreamingText] = useState('');
  const [consent, setConsent] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [liveFace, setLiveFace] = useState(null);
  const [emotionTrend, setEmotionTrend] = useState([]);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const latestFrameRef = useRef(null);

  const handleFrameCapture = useCallback((frame) => {
    latestFrameRef.current = frame;
  }, []);

  const handleLiveEmotionUpdate = useCallback((data) => {
    setLiveFace(data);
  }, []);

  const scrollToBottom = useCallback((instant = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: instant ? 'auto' : 'smooth',
    });
  }, []);

  useEffect(() => {
    scrollToBottom(messages.length <= 2);
  }, [messages, streamingText, scrollToBottom]);

  const loadMessages = useCallback(async (sessionId) => {
    if (!sessionId) return;
    try {
      const { data } = await api.get(`/api/sessions/${sessionId}/messages`);
      const list = Array.isArray(data) ? data : data.messages || [];
      setMessages(list);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load messages');
    }
  }, []);

  const loadTrend = useCallback(async () => {
    try {
      const { data } = await api.get('/api/analytics/emotions');
      setEmotionTrend(data.trend || []);
    } catch {
      /* non-critical */
    }
  }, []);

  // Auto-create a session on first load so Send always has a target
  useEffect(() => {
    let cancelled = false;

    async function initSessions() {
      try {
        setInitLoading(true);
        setError('');
        const { data: existing } = await api.get('/api/sessions');
        let sessionList = Array.isArray(existing) ? existing : [];

        if (sessionList.length === 0) {
          const { data: created } = await api.post('/api/sessions', { title: 'New Session' });
          sessionList = [created];
        }

        if (!cancelled) {
          setSessions(sessionList);
          setActiveSession(String(sessionList[0]._id));
          setSessionReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              'Could not connect to server. Make sure MongoDB and the server (port 5000) are running.'
          );
        }
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    }

    initSessions();
    loadTrend();

    return () => { cancelled = true; };
  }, [loadTrend]);

  useEffect(() => {
    if (activeSession) loadMessages(activeSession);
  }, [activeSession, loadMessages]);

  async function ensureSession() {
    if (activeSession) return activeSession;
    const { data } = await api.post('/api/sessions', { title: 'New Session' });
    setSessions((prev) => [data, ...prev]);
    setActiveSession(String(data._id));
    setSessionReady(true);
    return String(data._id);
  }

  async function createSession() {
    try {
      const { data } = await api.post('/api/sessions', { title: 'New Session' });
      setSessions((prev) => [data, ...prev]);
      setActiveSession(String(data._id));
      setMessages([]);
      setAnalysis(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create session');
    }
  }

  function logout() {
    setAuthToken(null);
    window.location.href = '/login';
  }

  async function sendViaApi(sessionId, text, imageBase64) {
    const { data } = await api.post(`/api/sessions/${sessionId}/messages`, { text, imageBase64 });
    return data;
  }

  async function sendViaStream(sessionId, text, imageBase64, onToken) {
    const token = localStorage.getItem('neurowell_token') || localStorage.getItem('token');
    const apiUrl = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000';

    const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text, imageBase64 }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.message || `Server error ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Streaming not supported in this browser');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let gotDone = false;
    let streamAnalysis = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const payload = JSON.parse(line.slice(6));

        if (payload.error) throw new Error(payload.error);

        if (payload.meta?.analysis) {
          streamAnalysis = payload.meta.analysis;
          setAnalysis(streamAnalysis);
        }

        if (payload.safetyTriggered) setCrisisOpen(true);

        if (payload.token) {
          if (payload.done && payload.safetyTriggered) {
            fullText = payload.token;
          } else if (!payload.done) {
            fullText += payload.token;
          }
          onToken(fullText);
        }

        if (payload.done) {
          gotDone = true;
          return { fullText: fullText.trim(), analysis: streamAnalysis, safetyTriggered: !!payload.safetyTriggered };
        }
      }
    }

    if (!gotDone) throw new Error('Stream ended before response completed');
    return { fullText: fullText.trim(), analysis: streamAnalysis };
  }

  async function sendMessage(e) {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || loading || initLoading) return;

    setInput('');
    setLoading(true);
    setStreamingText('');
    setError('');

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { _id: tempId, sender: 'user', text }]);

    const imageBase64 = consent ? latestFrameRef.current : null;

    try {
      const sessionId = await ensureSession();

      try {
        const result = await sendViaStream(sessionId, text, imageBase64, (partial) => {
          setStreamingText(partial);
        });

        setStreamingText('');
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m._id !== tempId);
          const hasUser = withoutTemp.some((m) => m.sender === 'user' && m.text === text);
          return [
            ...(hasUser ? withoutTemp : [...withoutTemp, { _id: tempId, sender: 'user', text }]),
            { _id: `ai-${Date.now()}`, sender: 'ai', text: result.fullText },
          ];
        });
        if (result.analysis) setAnalysis(result.analysis);
        if (result.safetyTriggered) setCrisisOpen(true);
        loadTrend();
      } catch (streamErr) {
        console.warn('Stream failed, using standard API:', streamErr.message);
        setStreamingText('');

        const data = await sendViaApi(sessionId, text, imageBase64);

        if (data.safetyTriggered) setCrisisOpen(true);
        if (data.analysis) setAnalysis(data.analysis);

        const userMsg = data.userMessage || { sender: 'user', text };
        const aiMsg = data.aiMessage || data.message || { sender: 'ai', text: data.botResponse || '' };

        setMessages((prev) => [
          ...prev.filter((m) => m._id !== tempId),
          userMsg,
          aiMsg,
        ]);

        loadTrend();
      }
    } catch (err) {
      setError(err.message || 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setInput(text);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  }

  const canSend = !loading && !initLoading && input.trim().length > 0;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2>NeuroWell</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Hi, {user?.name?.split(' ')[0] || 'there'}</p>
        <button
          onClick={createSession}
          style={{ background: 'var(--surface2)', color: 'var(--text)', padding: '10px', borderRadius: 10 }}
        >
          + New Session
        </button>
        {sessions.map((s) => (
          <div
            key={s._id}
            className={`session-item ${String(activeSession) === String(s._id) ? 'active' : ''}`}
            onClick={() => setActiveSession(String(s._id))}
          >
            {s.title || 'Session'}
          </div>
        ))}
        <button
          onClick={logout}
          style={{ marginTop: 'auto', background: 'transparent', color: 'var(--muted)', padding: '8px', fontSize: '0.85rem' }}
        >
          Sign out
        </button>
      </aside>

      <main className="chat-area">
        <div className="chat-header">
          <div>
            <strong>Chat</strong>
            {initLoading && <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: '0.85rem' }}>Starting session…</span>}
            {!initLoading && sessionReady && (
              <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: '0.85rem' }}>Ready</span>
            )}
            {!initLoading && sessionReady && consent && liveFace?.dominant_emotion && (
              <span style={{ marginLeft: 8, color: 'var(--accent)', fontSize: '0.85rem' }}>
                Live: {liveFace.dominant_emotion}
              </span>
            )}
            {analysis && (
              <div style={{ marginTop: 4 }}>
                <span className="analysis-chip">{analysis.textEmotion}</span>
                {(analysis.facialEmotion !== 'No Input' || liveFace?.dominant_emotion) && (
                  <span className="analysis-chip">
                    Face: {consent && liveFace?.dominant_emotion ? liveFace.dominant_emotion : analysis.facialEmotion}
                  </span>
                )}
                {analysis.cognitiveDistortion !== 'None' && (
                  <span className="analysis-chip">{analysis.cognitiveDistortion}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {error && <div className="error-banner" style={{ margin: '0.5rem 1.5rem' }}>{error}</div>}

        <div className="messages" ref={messagesContainerRef}>
          {messages.length === 0 && !initLoading && (
            <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '2rem' }}>
              Say hello — ask anything, or tell me how you're feeling.
            </p>
          )}
          {messages.map((m, i) => (
            <ChatMessage key={m._id || i} sender={m.sender} text={m.text} />
          ))}
          {streamingText && <ChatMessage sender="ai" text={streamingText} streaming />}
          {!streamingText && loading && (
            <ChatMessage sender="ai" text="NeuroWell is thinking…" streaming />
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-row" onSubmit={sendMessage}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={initLoading ? 'Loading session…' : 'Ask anything — coding, science, or how you\'re feeling…'}
            disabled={initLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend) sendMessage(e);
              }
            }}
          />
          <button type="submit" disabled={!canSend}>Send</button>
        </form>
      </main>

      <aside className="right-panel">
        <label className="consent-toggle">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          I consent to webcam emotion analysis
        </label>

        <WebcamPanel
          consent={consent}
          sessionId={activeSession}
          onFrameCapture={handleFrameCapture}
          onEmotionUpdate={handleLiveEmotionUpdate}
        />

        <ContradictionAlert
          visible={analysis?.contradictionDetected}
          facialEmotion={analysis?.facialEmotion || liveFace?.dominant_emotion}
        />

        <CBTExerciseCard
          distortion={analysis?.cognitiveDistortion}
          technique={analysis?.techniqueUsed}
        />

        <MoodChart data={emotionTrend} />
      </aside>

      <CrisisModal open={crisisOpen} onClose={() => setCrisisOpen(false)} />
    </div>
  );
}
