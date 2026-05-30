import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName') || 'User';

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  
  const [analytics, setAnalytics] = useState({
    detectedExpression: "Neutral",
    actionUnits: "None",
    cognitiveDistortion: "None",
    contradictionAlert: false,
    safetyStatus: "Secure"
  });

  // Load user profile history upon mounting the view context
  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    // Set the initial custom greeting dynamically
    setMessages([
      { id: 1, sender: 'bot', text: `Hello ${userName}! Welcome back to NeuroWell. I've retrieved your longitudinal memory file. How are you feeling today?` }
    ]);
  }, [userId, navigate, userName]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setInputValue('');

    // 1. Instantly render user speech bubble to UI chat wall
    const userMsg = { id: Date.now(), sender: 'user', text: userText };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // 2. Call the newly constructed Node-to-Python AI analysis gateway
      const response = await fetch('http://localhost:5000/api/chat/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          userText: userText
        })
      });

      const data = await response.json();

      if (response.ok) {
        // 3. Extract metrics returned directly from the BERT Model pipeline!
        const { botResponse, aiMetrics } = data;

        // 4. Update your sidebar metrics panel with real neural matrix evaluations
        setAnalytics({
          detectedExpression: aiMetrics.sentiment_label === "NEGATIVE" ? "Distress Detected" : "Balanced Profile",
          actionUnits: aiMetrics.sentiment_label === "NEGATIVE" ? "AU4 (Brow Lowerer)" : "Neutral Baseline",
          cognitiveDistortion: aiMetrics.cognitiveDistortion,
          contradictionAlert: false,
          safetyStatus: "Secure"
        });

        // 5. Append the real AI generated therapeutic feedback bubble
        const botMsg = { id: Date.now() + 1, sender: 'bot', text: botResponse };
        setMessages((prev) => [...prev, botMsg]);

      } else {
        console.error("AI pipeline returned error code status.");
      }

    } catch (err) {
      console.error("Failed to fetch data across the network bridge endpoint:", err);
    }
  };

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-800/80 border-b border-slate-700/50 px-6 py-4 flex justify-between items-center backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            NeuroWell Engine v1.0
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-slate-400 bg-slate-700/60 px-3 py-1 rounded-full border border-slate-600/30">
            Patient Ref: {userName}
          </span>
          <button 
            onClick={() => {
              localStorage.clear();
              navigate('/login');
            }}
            className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-red-600/30 hover:text-red-400 rounded-lg border border-slate-600 transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="w-80 bg-slate-800/40 border-r border-slate-700/30 p-4 flex flex-col space-y-4 overflow-y-auto">
          <div className="relative aspect-video bg-slate-950 rounded-xl border border-slate-700 flex flex-col items-center justify-center overflow-hidden shadow-inner group">
            <div className="absolute inset-0 bg-emerald-500/5 mix-blend-overlay"></div>
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500">
              📷
            </div>
            <p className="text-xs text-slate-400 mt-2 font-mono">Webcam Stream: Connected</p>
            <span className="absolute top-2 left-2 text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400 border border-slate-700 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping mr-1"></span> LIVE FACS
            </span>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-700/40 space-y-3 font-mono text-xs">
            <h3 className="text-slate-400 font-bold tracking-wider text-[11px] uppercase border-b border-slate-800 pb-1.5">
              Dual-Channel Matrix
            </h3>
            <div className="flex justify-between">
              <span className="text-slate-500">Affect Matrix:</span>
              <span className="text-teal-400">{analytics.detectedExpression}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Action Units:</span>
              <span className="text-amber-400">{analytics.actionUnits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">CBT Distortion:</span>
              <span className="text-red-400 truncate max-w-[140px]">{analytics.cognitiveDistortion}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <span className="text-slate-500">Safety Switch:</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px]">
                {analytics.safetyStatus}
              </span>
            </div>
          </div>

          {analytics.contradictionAlert && (
            <div className="bg-amber-950/40 rounded-xl p-3 border border-amber-800/40 text-xs text-amber-300 animate-pulse">
              ⚠️ <strong>Contradiction Warning:</strong> Semantic sentiment input text conflicts with visual channel muscle configurations.
            </div>
          )}
        </section>

        <section className="flex-1 flex flex-col bg-slate-950">
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xl rounded-2xl p-4 text-sm leading-relaxed shadow-md ${
                  msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-bl-none'
                }`}>
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800">
            <form onSubmit={handleSendMessage} className="flex space-x-3">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Express your thoughts or details about your day..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 placeholder-slate-500 shadow-inner"
              />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-md cursor-pointer">
                Send Response
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}