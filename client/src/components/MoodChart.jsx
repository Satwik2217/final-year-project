// Emotion trend line chart — Recharts dashboard of past session emotions.
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function MoodChart({ data }) {
  if (!data?.length) {
    return (
      <div className="chart-box">
        <h4>Emotion History</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Start chatting to see your emotional trend.</p>
      </div>
    );
  }

  const chartData = data.map((d, i) => ({
    label: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: d.score,
    emotion: d.textEmotion,
    idx: i,
  }));

  return (
    <div className="chart-box">
      <h4>Emotion History</h4>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis domain={[0, 5]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: '#1a2332', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Line type="monotone" dataKey="score" stroke="#5eead4" strokeWidth={2} dot={{ fill: '#818cf8' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
