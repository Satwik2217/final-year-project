import { useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

const VIDEO_CONSTRAINTS = {
  width: 640,
  height: 480,
  facingMode: 'user',
};

export default function WebcamPanel({ active, onFrameCapture }) {
  const webcamRef = useRef(null);
  const intervalRef = useRef(null);

  const captureFrame = useCallback(() => {
    if (!webcamRef.current || !active) return;
    const screenshot = webcamRef.current.getScreenshot();
    if (screenshot) onFrameCapture(screenshot);
  }, [active, onFrameCapture]);

  useEffect(() => {
    if (active) {
      captureFrame();
      intervalRef.current = setInterval(captureFrame, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, captureFrame]);

  if (!active) {
    return (
      <div className="relative aspect-video bg-slate-950 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
        <p className="text-xs text-slate-500 font-mono">Camera disabled — text-only mode</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-slate-950 rounded-xl border border-slate-700 overflow-hidden shadow-inner">
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={VIDEO_CONSTRAINTS}
        className="w-full h-full object-cover"
        mirrored
      />
      <span className="absolute top-2 left-2 text-[10px] bg-slate-900/80 px-2 py-0.5 rounded text-emerald-400 border border-slate-700 flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        LIVE FACS
      </span>
    </div>
  );
}
