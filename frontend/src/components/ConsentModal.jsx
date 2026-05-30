export default function ConsentModal({ onAccept, onDecline }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-2">Camera & data consent</h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          NeuroWell uses your webcam (optional) for real-time facial emotion analysis alongside text,
          to detect contradictions and provide CBT-guided support. Session data is stored securely in
          MongoDB for longitudinal memory. This is not a replacement for professional mental health care.
        </p>
        <ul className="text-xs text-slate-500 space-y-1 mb-6 list-disc pl-4">
          <li>Text + facial channels analyzed together</li>
          <li>CBT interventions grounded in clinical knowledge (RAG)</li>
          <li>Crisis safety resources shown when high-risk language is detected</li>
        </ul>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl cursor-pointer"
          >
            Allow camera
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl border border-slate-600 cursor-pointer"
          >
            Text only
          </button>
        </div>
      </div>
    </div>
  );
}
