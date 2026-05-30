export default function MoodChart({ history }) {
  if (!history.length) {
    return (
      <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-700/40 text-[10px] text-slate-500">
        Mood trends appear after a few interactions.
      </div>
    );
  }

  const scoreMap = {
    Positive: 4,
    Balanced: 3,
    'Mild Negative': 2,
    'Distress Detected': 1,
    pending: 2,
  };

  return (
    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-700/40">
      <h3 className="text-slate-400 font-bold tracking-wider text-[10px] uppercase mb-2">
        Longitudinal Mood
      </h3>
      <div className="flex items-end gap-1 h-16">
        {history.slice(-12).map((entry, index) => {
          const score = scoreMap[entry.textEmotion] || 2;
          const height = `${score * 20}%`;
          const color = score <= 1 ? 'bg-red-500' : score <= 2 ? 'bg-amber-500' : 'bg-emerald-500';
          return (
            <div
              key={entry._id || index}
              title={`${entry.textEmotion} — ${new Date(entry.createdAt).toLocaleString()}`}
              className={`flex-1 rounded-t ${color} opacity-80 min-h-[8px]`}
              style={{ height }}
            />
          );
        })}
      </div>
    </div>
  );
}
