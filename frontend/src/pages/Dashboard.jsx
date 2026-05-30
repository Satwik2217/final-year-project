import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import ConsentModal from '../components/ConsentModal';
import CrisisModal from '../components/CrisisModal';
import WebcamPanel from '../components/WebcamPanel';
import MoodChart from '../components/MoodChart';

const DEFAULT_ANALYTICS = {
  detectedExpression: 'Awaiting input',
  actionUnits: 'None',
  cognitiveDistortion: 'None',
  contradictionDetected: false,
  safetyStatus: 'Secure',
  facialEmotion: 'No Input',
  visionEngine: 'None',
};

function formatSessionDate(dateStr) {
  return new Date(dateStr).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'User';
  const messagesEndRef = useRef(null);
  const latestFrameRef = useRef(null);

  const [consentResolved, setConsentResolved] = useState(
    () => localStorage.getItem('neurowell_consent') === 'true'
  );
  const [cameraAllowed, setCameraAllowed] = useState(
    () => localStorage.getItem('neurowell_camera') === 'true'
  );
  const [showConsent, setShowConsent] = useState(!consentResolved);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [moodHistory, setMoodHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(DEFAULT_ANALYTICS);
  const [showCrisisModal, setShowCrisisModal] = useState(false);

  const handleFrameCapture = useCallback((frame) => {
    latestFrameRef.current = frame;
  }, []);

  const loadMoodData = useCallback(async () => {
    try {
      const [history, stats] = await Promise.all([
        apiFetch('/api/analytics/emotion-history'),
        apiFetch('/api/analytics/summary'),
      ]);
      setMoodHistory(history);
      setSummary(stats);
    } catch {
      // non-critical
    }
  }, []);

  const loadSessionMessages = useCallback(async (sessionId) => {
    const data = await apiFetch(`/api/sessions/${sessionId}/messages`);
    setMessages(
      data.messages.map((msg) => ({
        id: msg._id,
        sender: msg.sender === 'ai' ? 'bot' : 'user',
        text: msg.text,
      }))
    );
    setActiveSessionId(sessionId);
  }, []);

  const startNewSession = useCallback(async () => {
    const data = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ sessionTitle: `Session ${new Date().toLocaleDateString()}` }),
    });

    setSessions((prev) => [data.session, ...prev]);
    setMessages(
      data.messages.map((msg) => ({
        id: msg._id,
        sender: msg.sender === 'ai' ? 'bot' : 'user',
        text: msg.text,
      }))
    );
    setActiveSessionId(data.session._id);
    setAnalytics(DEFAULT_ANALYTICS);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const sessionList = await apiFetch('/api/sessions');
        await loadMoodData();

        if (sessionList.length > 0) {
          setSessions(sessionList);
          await loadSessionMessages(sessionList[0]._id);
        } else {
          await startNewSession();
        }
      } catch (err) {
        if (err.message.includes('token') || err.message.includes('Session expired')) {
          localStorage.clear();
          navigate('/login');
          return;
        }
        setError(err.message || 'Failed to load sessions');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [loadSessionMessages, loadMoodData, navigate, startNewSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConsent = (allowCamera) => {
    localStorage.setItem('neurowell_consent', 'true');
    localStorage.setItem('neurowell_camera', allowCamera ? 'true' : 'false');
    setCameraAllowed(allowCamera);
    setConsentResolved(true);
    setShowConsent(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeSessionId || sending) return;

    const userText = inputValue.trim();
    setInputValue('');
    setSending(true);
    setError('');

    const tempUserMsg = { id: `temp-${Date.now()}`, sender: 'user', text: userText };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const data = await apiFetch(`/api/sessions/${activeSessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          text: userText,
          imageBase64: cameraAllowed ? latestFrameRef.current : null,
        }),
      });

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        { id: data.userMessage._id, sender: 'user', text: data.userMessage.text },
        { id: data.aiMessage._id, sender: 'bot', text: data.aiMessage.text },
      ]);

      if (data.metrics) {
        setAnalytics({
          detectedExpression: data.metrics.detectedExpression,
          actionUnits: data.metrics.actionUnits,
          cognitiveDistortion: data.metrics.cognitiveDistortion,
          contradictionDetected: data.metrics.contradictionDetected,
          safetyStatus: data.metrics.safetyStatus,
          facialEmotion: data.metrics.facialEmotion,
          visionEngine: data.metrics.visionEngine,
        });
      }

      if (data.safetyTriggered) {
        setShowCrisisModal(true);
      }

      await loadMoodData();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <p className="text-slate-400">Loading NeuroWell engine…</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {showConsent && (
        <ConsentModal
          onAccept={() => handleConsent(true)}
          onDecline={() => handleConsent(false)}
        />
      )}
      {showCrisisModal && <CrisisModal onClose={() => setShowCrisisModal(false)} />}

      <header className="bg-slate-800/80 border-b border-slate-700/50 px-6 py-4 flex justify-between items-center backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              NeuroWell — Beyond Generative AI
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">Multimodal CBT Engine · RAG · Longitudinal Memory</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-slate-400 bg-slate-700/60 px-3 py-1 rounded-full border border-slate-600/30">
            {userName}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-red-600/30 hover:text-red-400 rounded-lg border border-slate-600 transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="w-80 bg-slate-800/40 border-r border-slate-700/30 p-4 flex flex-col space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-400 font-bold tracking-wider text-[11px] uppercase">Past Sessions</h3>
            <button
              type="button"
              onClick={startNewSession}
              className="text-[11px] px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-700/40 hover:bg-emerald-600/30 cursor-pointer"
            >
              + New
            </button>
          </div>

          <div className="space-y-2 max-h-32 overflow-y-auto">
            {sessions.map((session) => (
              <button
                key={session._id}
                type="button"
                onClick={() => loadSessionMessages(session._id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all cursor-pointer ${
                  activeSessionId === session._id
                    ? 'bg-emerald-600/20 border-emerald-600/40 text-emerald-300'
                    : 'bg-slate-950/40 border-slate-700/40 text-slate-400 hover:border-slate-600'
                }`}
              >
                <p className="font-medium truncate">{session.sessionTitle}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{formatSessionDate(session.startedAt)}</p>
              </button>
            ))}
          </div>

          <WebcamPanel active={cameraAllowed && consentResolved} onFrameCapture={handleFrameCapture} />

          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-700/40 space-y-2 font-mono text-xs">
            <h3 className="text-slate-400 font-bold tracking-wider text-[11px] uppercase border-b border-slate-800 pb-1.5">
              Dual-Channel Matrix
            </h3>
            <div className="flex justify-between">
              <span className="text-slate-500">Text Affect:</span>
              <span className="text-teal-400">{analytics.detectedExpression}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Facial Affect:</span>
              <span className="text-blue-400">{analytics.facialEmotion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">FACS Units:</span>
              <span className="text-amber-400">{analytics.actionUnits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">CBT Distortion:</span>
              <span className="text-red-400 truncate max-w-[120px]">{analytics.cognitiveDistortion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vision Engine:</span>
              <span className="text-slate-400">{analytics.visionEngine}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <span className="text-slate-500">Safety:</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${
                  analytics.safetyStatus === 'Alert'
                    ? 'text-red-400 bg-red-500/10'
                    : analytics.safetyStatus === 'Caution'
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-emerald-400 bg-emerald-500/10'
                }`}
              >
                {analytics.safetyStatus}
              </span>
            </div>
          </div>

          {analytics.contradictionDetected && (
            <div className="bg-amber-950/40 rounded-xl p-3 border border-amber-800/40 text-xs text-amber-300">
              Contradiction detected: text and facial channels conflict. Empathetic exploration triggered.
            </div>
          )}

          <MoodChart history={moodHistory} />

          {summary && (
            <div className="text-[10px] text-slate-500 space-y-0.5">
              <p>Interactions: {summary.totalInteractions}</p>
              <p>Contradictions: {summary.contradictionsDetected}</p>
              <p>Top distortion: {summary.commonDistortion}</p>
            </div>
          )}
        </section>

        <section className="flex-1 flex flex-col bg-slate-950">
          {error && (
            <div className="mx-6 mt-4 text-sm text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-2">
              {error}
            </div>
          )}

          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xl rounded-2xl p-4 text-sm leading-relaxed shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-bl-none px-4 py-3 text-xs text-slate-400">
                  Analyzing text + vision channels · retrieving CBT context…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800">
            <form onSubmit={handleSendMessage} className="flex space-x-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Share how you're feeling…"
                disabled={sending}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 placeholder-slate-500 shadow-inner disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !inputValue.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-md cursor-pointer"
              >
                {sending ? 'Analyzing…' : 'Send'}
              </button>
            </form>
            <p className="text-[10px] text-slate-600 mt-2 text-center">
              Not a substitute for professional care · RAG-grounded CBT · Multimodal analysis
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
