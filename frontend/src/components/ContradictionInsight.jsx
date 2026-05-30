export default function ContradictionInsight({ metrics }) {
  if (!metrics?.contradictionDetected) return null;

  const textFeel = metrics.textEmotionHuman || 'calm in your words';
  const faceFeel = metrics.facialEmotionHuman || metrics.facialEmotion?.toLowerCase();

  return (
    <div className="mx-6 mt-2 mb-1">
      <div className="bg-amber-950/30 border border-amber-700/30 rounded-2xl px-4 py-3 flex gap-3 items-start">
        <span className="text-lg shrink-0" aria-hidden>💛</span>
        <div className="text-xs leading-relaxed">
          <p className="text-amber-200/90 font-medium mb-1">I noticed something worth exploring gently</p>
          <p className="text-amber-100/70">
            Your words felt <span className="text-amber-200">{textFeel}</span>
            {faceFeel && (
              <>
                , but your expression seemed to show{' '}
                <span className="text-amber-200">{faceFeel}</span>
              </>
            )}
            . NeuroWell spoke to both — because both matter.
          </p>
        </div>
      </div>
    </div>
  );
}
