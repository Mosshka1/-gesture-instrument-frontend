import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const clamped = Math.max(inMin, Math.min(inMax, value));
  return ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

function distance(p1: any, p2: any) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function computeGestureParams(landmarks: any[]) {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const handSize = distance(wrist, middleMcp) || 0.1;

  const tips = [4, 8, 12, 16, 20].map((i) => landmarks[i]);
  const avgTipDistance = tips.reduce((sum, tip) => sum + distance(tip, wrist), 0) / tips.length;
  const openness = mapRange(avgTipDistance / handSize, 1.0, 2.6, 0, 1);

  const height = mapRange(wrist.y, 0.1, 0.9, 1, 0);
  const horizontal = mapRange(wrist.x, 0.1, 0.9, 0, 1);
  const span = mapRange(distance(landmarks[4], landmarks[20]) / handSize, 0.5, 2.2, 0, 1);

  return { openness, height, horizontal, span };
}

type Preset = {
  id: string;
  name: string;
  waveform: OscillatorType;
  filterType: BiquadFilterType;
  pitchRange: [number, number];
  filterRange: [number, number];
  smoothing: number;
};

const PRESETS: Preset[] = [
  {
    id: 'ambient',
    name: 'Ембіентний пад',
    waveform: 'sine',
    filterType: 'lowpass',
    pitchRange: [150, 500],
    filterRange: [300, 3000],
    smoothing: 0.15,
  },
  {
    id: 'lead',
    name: 'Яскравий лід',
    waveform: 'sawtooth',
    filterType: 'lowpass',
    pitchRange: [200, 900],
    filterRange: [500, 5000],
    smoothing: 0.35,
  },
  {
    id: 'soft',
    name: "М'який трикутник",
    waveform: 'triangle',
    filterType: 'bandpass',
    pitchRange: [180, 700],
    filterRange: [400, 4000],
    smoothing: 0.2,
  },
];

class HandVoice {
  audioCtx: AudioContext;
  oscillator: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  preset: Preset;

  smoothedGain = 0;
  smoothedPitch = 0;
  smoothedFilter = 0;

  constructor(audioCtx: AudioContext, preset: Preset) {
    this.audioCtx = audioCtx;
    this.preset = preset;

    this.oscillator = audioCtx.createOscillator();
    this.gain = audioCtx.createGain();
    this.filter = audioCtx.createBiquadFilter();

    this.oscillator.type = preset.waveform;
    this.filter.type = preset.filterType;
    this.gain.gain.value = 0;

    this.oscillator.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(audioCtx.destination);

    this.oscillator.start();
  }

  setPreset(preset: Preset) {
    this.preset = preset;
    this.oscillator.type = preset.waveform;
    this.filter.type = preset.filterType;
  }

  update(landmarks: any[]) {
    const { openness, height, horizontal, span } = computeGestureParams(landmarks);
    const { pitchRange, filterRange, smoothing } = this.preset;

    const targetVolume = openness * mapRange(height, 0, 1, 0.15, 0.4);
    this.smoothedGain += (targetVolume - this.smoothedGain) * smoothing;
    this.gain.gain.value = this.smoothedGain;

    const targetPitch = mapRange(horizontal, 0, 1, pitchRange[0], pitchRange[1]);
    this.smoothedPitch += (targetPitch - this.smoothedPitch) * smoothing;
    this.oscillator.frequency.value = this.smoothedPitch;

    const targetFilter = mapRange(span, 0, 1, filterRange[0], filterRange[1]);
    this.smoothedFilter += (targetFilter - this.smoothedFilter) * smoothing;
    this.filter.frequency.value = this.smoothedFilter;
  }

  stop() {
    try {
      this.gain.gain.value = 0;
      this.oscillator.stop();
    } catch {
      // осцилятор уже міг бути зупинений — ігноруємо
    }
  }
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const voicesRef = useRef<HandVoice[]>([]);
  const presetRef = useRef<Preset>(PRESETS[0]);
  const [audioStarted, setAudioStarted] = useState(false);
  const [activePresetId, setActivePresetId] = useState(PRESETS[0].id);

  const startAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    setAudioStarted(true);
  };

  const selectPreset = (preset: Preset) => {
    presetRef.current = preset;
    setActivePresetId(preset.id);
    voicesRef.current.forEach((voice) => voice.setPreset(preset));
  };

  useEffect(() => {
    let cameraInstance: any = null;
    let isActive = true;
    let handsInstance: any = null;

    const hands = new window.Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    handsInstance = hands;

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results: any) => {
      if (!isActive) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const handsFound = results.multiHandLandmarks || [];

      handsFound.forEach((landmarks: any[]) => {
        ctx.strokeStyle = '#4DC9B0';
        ctx.lineWidth = 2;
        HAND_CONNECTIONS.forEach(([start, end]) => {
          const p1 = landmarks[start];
          const p2 = landmarks[end];
          ctx.beginPath();
          ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
          ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
          ctx.stroke();
        });

        ctx.fillStyle = '#E8B54D';
        landmarks.forEach((point: any) => {
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, 2 * Math.PI);
          ctx.fill();
        });
      });

      ctx.restore();

      if (!audioCtxRef.current) return;

      while (voicesRef.current.length < handsFound.length) {
        voicesRef.current.push(new HandVoice(audioCtxRef.current, presetRef.current));
      }
      while (voicesRef.current.length > handsFound.length) {
        const voice = voicesRef.current.pop();
        voice?.stop();
      }

      handsFound.forEach((landmarks: any[], i: number) => {
        voicesRef.current[i].update(landmarks);
      });
    });

    if (videoRef.current) {
      cameraInstance = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && isActive) {
            await hands.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
      cameraInstance.start();
    }

    return () => {
      isActive = false;
      cameraInstance?.stop();
      handsInstance?.close?.();
      voicesRef.current.forEach((voice) => voice.stop());
      voicesRef.current = [];
    };
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 20 }}>
      <h1>Музичний інструмент — тест</h1>

      {!audioStarted && (
        <button onClick={startAudio} style={{ fontSize: 18, padding: '10px 20px' }}>
          ▶ Увімкнути звук
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => selectPreset(preset)}
            style={{
              padding: '8px 14px',
              background: activePresetId === preset.id ? '#4DC9B0' : '#eee',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', width: 640, height: 480 }}>
        <video
          ref={videoRef}
          style={{ position: 'absolute', width: 640, height: 480, transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{ position: 'absolute', width: 640, height: 480, transform: 'scaleX(-1)' }}
        />
      </div>
    </div>
  );
}

export default App;