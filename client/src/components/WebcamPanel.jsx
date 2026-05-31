// Webcam panel — real-time emotion every 1s; tries DeepFace direct, then server API.
import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 1000;
const API_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000';
const DEEPFACE_URL = import.meta.env.REACT_APP_DEEPFACE_URL || 'http://localhost:5001';

function normalizeEmotionLabel(emotion) {
  if (!emotion) return 'Unknown';
  const lower = emotion.toLowerCase();
  const map = {
    happy: 'Happy', happiness: 'Happy', sad: 'Sad', sadness: 'Sad',
    angry: 'Angry', anger: 'Angry', fear: 'Fear', fearful: 'Fear',
    surprise: 'Surprise', disgust: 'Disgust', neutral: 'Neutral',
    'no face detected': 'No Face Detected',
    'service offline': 'Service Offline',
  };
  return map[lower] || emotion.charAt(0).toUpperCase() + emotion.slice(1);
}

export default function WebcamPanel({ consent, sessionId, onEmotionUpdate, onFrameCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const loopTimerRef = useRef(null);
  const analyzingRef = useRef(false);
  const lastEmotionRef = useRef('');
  const mountedRef = useRef(true);
  const onEmotionUpdateRef = useRef(onEmotionUpdate);
  const onFrameCaptureRef = useRef(onFrameCapture);
  const sessionIdRef = useRef(sessionId);

  const [liveEmotion, setLiveEmotion] = useState('Waiting…');
  const [liveConfidence, setLiveConfidence] = useState(null);
  const [liveEngine, setLiveEngine] = useState('');
  const [emotionChanged, setEmotionChanged] = useState(false);
  const [error, setError] = useState('');

  onEmotionUpdateRef.current = onEmotionUpdate;
  onFrameCaptureRef.current = onFrameCapture;
  sessionIdRef.current = sessionId;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const maxW = 640;
    const scale = vw > maxW ? maxW / vw : 1;
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.75);
  }, []);

  const applyEmotionResult = useCallback((data) => {
    const emotion = normalizeEmotionLabel(data.dominant_emotion);
    const prev = lastEmotionRef.current;

    setLiveConfidence(data.confidence ?? null);
    setLiveEngine(data.engine || '');

    if (data.engine === 'Offline' || emotion === 'Service Offline') {
      setError(data.error || 'DeepFace offline — run: npm start (from project root)');
      setLiveEmotion('Service Offline');
      return;
    }

    setError('');

    if (emotion !== prev) {
      lastEmotionRef.current = emotion;
      setLiveEmotion(emotion);
      setEmotionChanged(true);
      setTimeout(() => mountedRef.current && setEmotionChanged(false), 500);
    } else if (prev === '') {
      setLiveEmotion(emotion);
      lastEmotionRef.current = emotion;
    }

    onEmotionUpdateRef.current?.({ ...data, dominant_emotion: emotion });
  }, []);

  const analyzeDirectDeepface = useCallback(async (frame) => {
    const res = await fetch(`${DEEPFACE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: frame }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`DeepFace HTTP ${res.status}`);
    return res.json();
  }, []);

  const analyzeViaServer = useCallback(async (frame, sid) => {
    const token = localStorage.getItem('neurowell_token') || localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/sessions/${sid}/face`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageBase64: frame }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`Server face API ${res.status}`);
    return res.json();
  }, []);

  const analyzeFrame = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!mountedRef.current || analyzingRef.current || !consent || !sid) return;

    const frame = captureFrame();
    if (!frame) return;

    onFrameCaptureRef.current?.(frame);
    analyzingRef.current = true;

    try {
      let data;
      try {
        data = await analyzeDirectDeepface(frame);
      } catch {
        data = await analyzeViaServer(frame, sid);
      }
      if (mountedRef.current) applyEmotionResult(data);
    } catch (err) {
      if (mountedRef.current) {
        setError('Could not reach emotion service. Run npm start from project root.');
        setLiveEmotion('Offline');
        setLiveEngine('Offline');
      }
    } finally {
      analyzingRef.current = false;
    }
  }, [consent, captureFrame, applyEmotionResult, analyzeDirectDeepface, analyzeViaServer]);

  useEffect(() => {
    if (!consent) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      clearTimeout(loopTimerRef.current);
      lastEmotionRef.current = '';
      setLiveEmotion('Camera off');
      setLiveConfidence(null);
      setLiveEngine('');
      setError('');
      return undefined;
    }

    let cancelled = false;

    const runLoop = async () => {
      if (cancelled || !mountedRef.current) return;
      await analyzeFrame();
      if (!cancelled) loopTimerRef.current = setTimeout(runLoop, POLL_MS);
    };

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.onloadeddata = () => {
            if (cancelled) return;
            setLiveEmotion('Detecting…');
            setError('');
            analyzeFrame();
            runLoop();
          };
        }
      } catch {
        setError('Could not access webcam.');
        setLiveEmotion('Unavailable');
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      clearTimeout(loopTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [consent, sessionId, analyzeFrame]);

  return (
    <div>
      <div className="consent-toggle" style={{ marginBottom: '0.5rem' }}>
        <span>
          Live emotion:{' '}
          <strong className={emotionChanged ? 'emotion-live-pulse' : ''} style={{ color: 'var(--accent)' }}>
            {liveEmotion}
          </strong>
          {liveConfidence != null && !['Detecting…', 'Offline', 'Service Offline'].includes(liveEmotion) && (
            <span style={{ color: 'var(--muted)', fontSize: '0.75rem', marginLeft: 6 }}>
              {Math.round(liveConfidence)}%
            </span>
          )}
        </span>
      </div>
      <div className="webcam-box">
        {consent ? (
          <video ref={videoRef} autoPlay muted playsInline />
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Enable webcam consent to activate camera
          </div>
        )}
        {consent && (
          <div className={`emotion-badge ${emotionChanged ? 'emotion-badge-flash' : ''}`}>
            {liveEmotion}
          </div>
        )}
      </div>
      {liveEngine && consent && liveEngine !== 'Offline' && (
        <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginTop: '0.35rem' }}>
          Engine: {liveEngine} · updates every 1s
        </p>
      )}
      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.5rem', lineHeight: 1.4 }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function captureWebcamFrame(videoRef) {
  const video = videoRef?.current;
  if (!video || video.readyState < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.7);
}
