export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 max-w-xl">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-bold shrink-0 shadow-lg shadow-emerald-900/30">
        N
      </div>
      <div className="bg-slate-800/90 border border-slate-700/50 rounded-2xl rounded-bl-md px-4 py-3 shadow-md">
        <p className="text-[11px] text-emerald-400/80 font-medium mb-1.5">NeuroWell is thinking…</p>
        <div className="flex gap-1.5 items-center h-4">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
