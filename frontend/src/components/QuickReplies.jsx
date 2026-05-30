const DEFAULT_SUGGESTIONS = [
  "I'm feeling anxious today",
  "I had a rough day",
  "Can we talk about stress?",
  "I'm okay, just tired",
];

export default function QuickReplies({ suggestions = DEFAULT_SUGGESTIONS, onSelect, disabled }) {
  const items = suggestions?.length ? suggestions : DEFAULT_SUGGESTIONS;

  return (
    <div className="px-4 pb-2 flex flex-wrap gap-2">
      {items.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(text)}
          className="text-xs px-3 py-1.5 rounded-full border border-slate-700/60 bg-slate-800/60 text-slate-300 hover:bg-emerald-600/20 hover:border-emerald-600/40 hover:text-emerald-300 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
