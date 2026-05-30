export default function CrisisModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/80 backdrop-blur-sm p-4">
      <div className="max-w-lg w-full bg-slate-900 border-2 border-red-600/50 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-red-400 mb-3">Safety alert — please reach out</h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          NeuroWell detected language that may indicate you are in crisis. You do not have to face this alone.
          Please contact a trained professional immediately.
        </p>
        <div className="space-y-2 text-sm text-slate-200 mb-6">
          <p><strong className="text-white">Tele-MANAS (India):</strong> 14416</p>
          <p><strong className="text-white">iCall:</strong> 9152987821</p>
          <p><strong className="text-white">Vandrevala Foundation:</strong> 1860-2662-345</p>
          <p><strong className="text-white">Emergency:</strong> 112</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-sm font-semibold rounded-xl border border-red-600/40 cursor-pointer"
        >
          I understand — show resources in chat
        </button>
      </div>
    </div>
  );
}
