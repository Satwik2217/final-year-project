// CBT exercise card — slides in when ALBERT detects a cognitive distortion.
const DISTORTION_INFO = {
  'Overgeneralization / All-or-Nothing Thinking': {
    title: 'Thought Challenging',
    tip: 'Look for exceptions to words like "always" or "never" — even one counter-example matters.',
  },
  Catastrophizing: {
    title: 'Decatastrophizing',
    tip: 'Ask: what is the most likely outcome, not just the worst one?',
  },
  'Mind Reading': {
    title: 'Evidence Check',
    tip: 'Separate what you know for sure from what you are assuming about others.',
  },
  'Emotional Reasoning': {
    title: 'Feeling vs Fact',
    tip: 'A feeling is valid — but it is not always a fact about reality.',
  },
  'Should Statements': {
    title: 'Flexible Thinking',
    tip: 'Try swapping "I should" with "I prefer" or "I would like to."',
  },
  'Mental Filter / Discounting Positives': {
    title: 'Behavioral Activation',
    tip: 'Name three small things that went okay today, even if they seem minor.',
  },
};

export default function CBTExerciseCard({ distortion, technique }) {
  if (!distortion || distortion === 'None') return null;

  const info = DISTORTION_INFO[distortion] || {
    title: technique || 'CBT Exercise',
    tip: 'Notice the thinking pattern and gently question whether it fits all the evidence.',
  };

  return (
    <div className="cbt-card">
      <h4>{info.title} · {distortion}</h4>
      <p style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>{info.tip}</p>
    </div>
  );
}
