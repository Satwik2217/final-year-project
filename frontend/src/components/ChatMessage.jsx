import { useTypewriter } from '../hooks/useTypewriter';

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessage({ message, userName, animate = false }) {
  const isUser = message.sender === 'user';
  const { displayed, done } = useTypewriter(message.text, animate && !isUser);

  return (
    <div className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser ? (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-bold shrink-0 shadow-lg shadow-emerald-900/30">
          N
        </div>
      ) : (
        <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-semibold shrink-0 text-slate-300">
          {userName?.charAt(0)?.toUpperCase() || 'Y'}
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-medium text-slate-500">
            {isUser ? 'You' : 'NeuroWell'}
          </span>
          {message.createdAt && (
            <span className="text-[10px] text-slate-600">{formatTime(message.createdAt)}</span>
          )}
        </div>

        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
            isUser
              ? 'bg-emerald-600 text-white rounded-br-md'
              : 'bg-slate-800/95 text-slate-100 border border-slate-700/50 rounded-bl-md'
          }`}
        >
          <p className="whitespace-pre-wrap">{isUser ? message.text : displayed}</p>
          {!isUser && animate && !done && (
            <span className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}
