import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import ConsentModal from '../components/ConsentModal';
import CrisisModal from '../components/CrisisModal';
import WebcamPanel from '../components/WebcamPanel';
import MoodChart from '../components/MoodChart';
import ChatMessage from '../components/ChatMessage';
import TypingIndicator from '../components/TypingIndicator';
import QuickReplies from '../components/QuickReplies';
import ContradictionInsight from '../components/ContradictionInsight';

const DEFAULT_ANALYTICS = {
  detectedExpression: 'Awaiting input',
  actionUnits: 'None',
  cognitiveDistortion: 'None',
  contradictionDetected: false,
  safetyStatus: 'Secure',
  facialEmotion: 'No Input',
  visionEngine: 'None',
};

const DEFAULT_QUICK_REPLIES = [
  "I'm feeling anxious today",
  "I had a rough day",
  "Can we talk about stress?",
  "I'm okay, just tired",
];

function formatSessionDate(dateStr) {
  return new Date(dateStr).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapMessage(msg) {
  return {
    id: msg._id,
    sender: msg.sender === 'ai' ? 'bot' : 'user',
    text: msg.text,
    createdAt: msg.createdAt,
    animate: false,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'User';
  const messagesEndRef = useRef(null);
  const latestFrameRef = useRef(null);
  const textareaRef = useRef(null);

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
  const [typingStage, setTypingStage] = useState('');
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(DEFAULT_ANALYTICS);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [quickReplies, setQuickReplies] = useState(DEFAULT_QUICK_REPLIES);

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
    setMessages(data.messages.map(mapMessage));
    setActiveSessionId(sessionId);
    setQuickReplies(DEFAULT_QUICK_REPLIES);
  }, []);

  const startNewSession = useCallback(async () => {
    const data = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ sessionTitle: `Session ${new Date().toLocaleDateString()}` }),
    });

    setSessions((prev) => [data.session, ...prev]);
    setMessages(data.messages.map(mapMessage));
    setActiveSessionId(data.session._id);
    setAnalytics(DEFAULT_ANALYTICS);
    setQuickReplies(DEFAULT_QUICK_REPLIES);
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
  }, [messages, sending, typingStage]);

  const handleConsent = (allowCamera) => {
    localStorage.setItem('neurowell_consent', 'true');
    localStorage.setItem('neurowell_camera', allowCamera ? 'true' : 'false');
    setCameraAllowed(allowCamera);
    setConsentResolved(true);
    setShowConsent(false);
  };

  const sendText = async (userText) => {
    if (!userText.trim() || !activeSessionId || sending) return;

    const trimmed = userText.trim();
    setInputValue('');
    setSending(true);
    setError('');
    setTypingStage('listening');

    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      createdAt: new Date().toISOString(),
      animate: false,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      setTimeout(() => setTypingStage('analyzing'), 600);
      setTimeout(() => setTypingStage('composing'), 1800);

      const data = await apiFetch(`/api/sessions/${activeSessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          text: trimmed,
          imageBase64: cameraAllowed ? latestFrameRef.current : null,
        }),
      });

      setTypingStage('');

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        {
          id: data.userMessage._id,
          sender: 'user',
          text: data.userMessage.text,
          createdAt: data.userMessage.createdAt,
          animate: false,
        },
        {
          id: data.aiMessage._id,
          sender: 'bot',
          text: data.aiMessage.text,
          createdAt: data.aiMessage.createdAt,
          animate: true,
        },
      ]);

      if (data.metrics) {
        setAnalytics({
          detectedExpression: data.metrics.detectedExpression,
          actionUnits: data.metrics.actionUnits,
          cognitiveDistortion: data.metrics.cognitiveDistortion,
          contradictionDetected: data.metrics.contradictionDetected,
          contradictionType: data.metrics.contradictionType,
          textEmotionHuman: data.metrics.textEmotionHuman,
          facialEmotionHuman: data.metrics.facialEmotionHuman,
          safetyStatus: data.metrics.safetyStatus,
          facialEmotion: data.metrics.facialEmotion,
          visionEngine: data.metrics.visionEngine,
        });
      }

      if (data.quickReplies?.length) {
        setQuickReplies(data.quickReplies);
      }

      if (data.safetyTriggered) {
        setShowCrisisModal(true);
      }

      await loadMoodData();
    } catch (err) {
      setTypingStage('');
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    sendText(inputValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText(inputValue);
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
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm font-bold animate-pulse">
            N
          </div>
          <p className="text-slate-400 text-sm">NeuroWell is preparing your space…</p>
        </div>
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

      <header className="bg-slate-800/80 border-b border-slate-700/50 px-6 py-4 flex justify-between items-center backdrop-blur-md shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm font-bold shadow-lg shadow-emerald-900/20">
            N
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">NeuroWell</h1>
            <p className="text-[11px] text-emerald-400/80 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              {sending ? 'Listening & responding…' : 'Here with you · RAG-grounded CBT'}
            </p>
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
        <section className="w-80 bg-slate-800/40 border-r border-slate-700/30 p-4 flex flex-col space-y-3 overflow-y-auto shrink-0">
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
              Live Analysis
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
              <span className="text-slate-500">CBT Pattern:</span>
              <span className="text-red-400 truncate max-w-[120px]">{analytics.cognitiveDistortion}</span>
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
            <div className="bg-amber-950/40 rounded-xl p-3 border border-amber-800/40 text-xs text-amber-300 space-y-1">
              <p className="font-medium">Emotion mismatch noticed</p>
              {analytics.textEmotionHuman && analytics.facialEmotionHuman && (
                <p>
                  Words: <span className="text-amber-200">{analytics.textEmotionHuman}</span>
                  <br />
                  Expression: <span className="text-amber-200">{analytics.facialEmotionHuman}</span>
                </p>
              )}
            </div>
          )}

          <MoodChart history={moodHistory} />

          {summary && (
            <div className="text-[10px] text-slate-500 space-y-0.5">
              <p>Conversations: {summary.totalInteractions}</p>
              <p>Longitudinal memory active</p>
            </div>
          )}
        </section>

        <section className="flex-1 flex flex-col bg-slate-950 min-w-0">
          {error && (
            <div className="mx-6 mt-4 text-sm text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-2">
              {error}
            </div>
          )}

          <ContradictionInsight metrics={analytics} />

          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                userName={userName}
                animate={msg.animate}
              />
            ))}

            {sending && (
              <div className="space-y-2">
                <TypingIndicator />
                {typingStage === 'analyzing' && (
                  <p className="text-[11px] text-slate-500 pl-12">Reading your words & expression…</p>
                )}
                {typingStage === 'composing' && (
                  <p className="text-[11px] text-slate-500 pl-12">Retrieving CBT guidance from memory…</p>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <QuickReplies
            suggestions={quickReplies}
            onSelect={sendText}
            disabled={sending}
          />

          <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`What's on your mind, ${userName.split(' ')[0] || 'friend'}?`}
                disabled={sending}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 placeholder-slate-500 shadow-inner disabled:opacity-50 resize-none min-h-[48px] max-h-32"
              />
              <button
                type="submit"
                disabled={sending || !inputValue.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm px-5 py-3 rounded-2xl shadow-md cursor-pointer shrink-0"
              >
                Send
              </button>
            </form>
            <p className="text-[10px] text-slate-600 mt-2 text-center">
              Shift+Enter for new line · Empathetic AI grounded in CBT knowledge base
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
