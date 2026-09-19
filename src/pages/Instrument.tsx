import { useEffect, useRef, useState } from 'react';
import { getPresets, createPreset, deletePreset } from '../api';

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

const PINCH_THRESHOLD = 0.55;

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

  // Щипки великого пальця з кожним іншим пальцем окремо
  const pinchIndex = distance(landmarks[4], landmarks[8]) / handSize;
  const pinchMiddle = distance(landmarks[4], landmarks[12]) / handSize;
  const pinchRing = distance(landmarks[4], landmarks[16]) / handSize;
  const pinchPinky = distance(landmarks[4], landmarks[20]) / handSize;

  // Жест "перемога" (V)
  const indexExtended = distance(landmarks[8], wrist) / handSize > 1.8;
  const middleExtended = distance(landmarks[12], wrist) / handSize > 1.8;
  const ringCurled = distance(landmarks[16], wrist) / handSize < 1.4;
  const pinkyCurled = distance(landmarks[20], wrist) / handSize < 1.4;
  const isPeaceSign = indexExtended && middleExtended && ringCurled && pinkyCurled;

  // Нахил (поворот) долоні: кут лінії від основи вказівного до основи мізинця
  const rotationAngle = Math.atan2(
    landmarks[17].y - landmarks[5].y,
    landmarks[17].x - landmarks[5].x
  );
  // Нормалізуємо в діапазон -1 (нахил в один бік) .. 1 (нахил в інший)
  const tilt = mapRange(rotationAngle, -Math.PI / 2, Math.PI / 2, -1, 1);

  // Розмір руки в кадрі — проксі для відстані до камери (більше = ближче)
  const proximity = mapRange(handSize, 0.15, 0.35, 0, 1);

  return {
    openness,
    height,
    horizontal,
    span,
    pinchIndex,
    pinchMiddle,
    pinchRing,
    pinchPinky,
    isPeaceSign,
    tilt,
    proximity,
  };
}

function playPluckSound(audioCtx: AudioContext, frequency: number, waveform: OscillatorType, destination: AudioNode) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = waveform;
  osc.frequency.value = frequency;

  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.4, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(now);
  osc.stop(now + 0.45);
}

function playPercussionHit(audioCtx: AudioContext, centerFrequency: number, destination: AudioNode) {
  const bufferSize = audioCtx.sampleRate * 0.2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = centerFrequency;
  bandpass.Q.value = 1.2;

  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  noise.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(destination);

  noise.start(now);
  noise.stop(now + 0.2);
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

type SavedPreset = {
  id: number;
  name: string;
  soundType: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
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

// Музичні інтервали для кожного пальця (відносно кореневої ноти) — грають ніби акорд по частинах
const FINGER_INTERVALS = {
  index: 1, // корінь
  middle: 1.25, // велика терція
  ring: 1.5, // квінта
  pinky: 2, // октава
};

type VoiceEvents = {
  pluckedFinger: 'index' | 'middle' | 'ring' | 'pinky' | null;
  hit: boolean;
};

class HandVoice {
  audioCtx: AudioContext;
  oscillator: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  panner: StereoPannerNode;
  delay: DelayNode;
  delayFeedback: GainNode;
  wetGain: GainNode;
  preset: Preset;

  smoothedGain = 0;
  smoothedPitch = 0;
  smoothedFilter = 0;
  smoothedTilt = 0;
  smoothedWet = 0;

  wasPinching = { index: false, middle: false, ring: false, pinky: false };
  wasPeaceSign = false;

  constructor(audioCtx: AudioContext, preset: Preset) {
    this.audioCtx = audioCtx;
    this.preset = preset;

    this.oscillator = audioCtx.createOscillator();
    this.gain = audioCtx.createGain();
    this.filter = audioCtx.createBiquadFilter();
    this.panner = audioCtx.createStereoPanner();
    this.delay = audioCtx.createDelay(1.0);
    this.delayFeedback = audioCtx.createGain();
    this.wetGain = audioCtx.createGain();

    this.oscillator.type = preset.waveform;
    this.filter.type = preset.filterType;
    this.gain.gain.value = 0;
    this.delay.delayTime.value = 0.28;
    this.delayFeedback.gain.value = 0.3;
    this.wetGain.gain.value = 0;

    // Сухий сигнал: осцилятор -> фільтр -> гучність -> панорама -> вихід
    this.oscillator.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.panner);
    this.panner.connect(audioCtx.destination);

    // "Мокрий" сигнал (відлуння): гучність -> затримка -> (петля зворотного зв'язку) -> wetGain -> панорама
    this.gain.connect(this.delay);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.wetGain);
    this.wetGain.connect(this.panner);

    this.oscillator.start();
  }

  setPreset(preset: Preset) {
    this.preset = preset;
    this.oscillator.type = preset.waveform;
    this.filter.type = preset.filterType;
  }

  update(landmarks: any[]): VoiceEvents {
    const {
      openness,
      height,
      horizontal,
      span,
      pinchIndex,
      pinchMiddle,
      pinchRing,
      pinchPinky,
      isPeaceSign,
      tilt,
      proximity,
    } = computeGestureParams(landmarks);
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

    // Нахил руки -> стереопанорама (плавно згладжено, щоб не смикало звук)
    this.smoothedTilt += (tilt - this.smoothedTilt) * 0.1;
    this.panner.pan.value = Math.max(-1, Math.min(1, this.smoothedTilt));

    // Близькість до камери -> скільки "мокрого" відлуння додається (далі = більше відлуння)
    const targetWet = mapRange(proximity, 0, 1, 0.35, 0);
    this.smoothedWet += (targetWet - this.smoothedWet) * 0.08;
    this.wetGain.gain.value = this.smoothedWet;

    const events: VoiceEvents = { pluckedFinger: null, hit: false };

    const checkPinch = (key: keyof typeof this.wasPinching, value: number, fingerName: 'index' | 'middle' | 'ring' | 'pinky') => {
      const isPinching = value < PINCH_THRESHOLD;
      if (isPinching && !this.wasPinching[key]) {
        const interval = FINGER_INTERVALS[fingerName];
        playPluckSound(this.audioCtx, this.smoothedPitch * interval, this.preset.waveform, this.panner);
        events.pluckedFinger = fingerName;
      }
      this.wasPinching[key] = isPinching;
    };

    checkPinch('index', pinchIndex, 'index');
    checkPinch('middle', pinchMiddle, 'middle');
    checkPinch('ring', pinchRing, 'ring');
    checkPinch('pinky', pinchPinky, 'pinky');

    if (isPeaceSign && !this.wasPeaceSign) {
      playPercussionHit(this.audioCtx, mapRange(horizontal, 0, 1, 800, 3000), this.panner);
      events.hit = true;
    }
    this.wasPeaceSign = isPeaceSign;

    return events;
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

function spawnParticles(particles: Particle[], x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
    });
  }
}

function updateAndDrawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life -= 0.03;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const FINGER_COLORS: Record<string, string> = {
  index: '#E8B54D',
  middle: '#4DC9B0',
  ring: '#C97BE8',
  pinky: '#E86B6B',
};

const FINGER_TIP_INDEX: Record<string, number> = {
  index: 8,
  middle: 12,
  ring: 16,
  pinky: 20,
};

function Instrument() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const voicesRef = useRef<HandVoice[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const presetRef = useRef<Preset>(PRESETS[0]);
  const [audioStarted, setAudioStarted] = useState(false);
  const [activePresetId, setActivePresetId] = useState(PRESETS[0].id);

  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState('');

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

  const loadPresets = async () => {
    try {
      const presets = await getPresets();
      setSavedPresets(presets);
    } catch (error) {
      console.error('Не вдалось завантажити пресети', error);
    }
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      alert('Введи назву пресету');
      return;
    }
    try {
      await createPreset(presetName, activePresetId);
      setPresetName('');
      loadPresets();
    } catch (error) {
      console.error('Не вдалось зберегти пресет', error);
      alert('Не вдалось зберегти пресет');
    }
  };

  const handleDeletePreset = async (id: number) => {
    try {
      await deletePreset(id);
      loadPresets();
    } catch (error) {
      console.error('Не вдалось видалити пресет', error);
    }
  };

  const handleSelectSavedPreset = (soundType: string) => {
    const preset = PRESETS.find((p) => p.id === soundType);
    if (preset) selectPreset(preset);
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

      if (audioCtxRef.current) {
        while (voicesRef.current.length < handsFound.length) {
          voicesRef.current.push(new HandVoice(audioCtxRef.current, presetRef.current));
        }
        while (voicesRef.current.length > handsFound.length) {
          const voice = voicesRef.current.pop();
          voice?.stop();
        }

        handsFound.forEach((landmarks: any[], i: number) => {
          const events = voicesRef.current[i].update(landmarks);

          if (events.pluckedFinger) {
            const tipIndex = FINGER_TIP_INDEX[events.pluckedFinger];
            const midX = ((landmarks[4].x + landmarks[tipIndex].x) / 2) * canvas.width;
            const midY = ((landmarks[4].y + landmarks[tipIndex].y) / 2) * canvas.height;
            spawnParticles(particlesRef.current, midX, midY, FINGER_COLORS[events.pluckedFinger], 10);
          }

          if (events.hit) {
            const wristX = landmarks[0].x * canvas.width;
            const wristY = landmarks[0].y * canvas.height;
            spawnParticles(particlesRef.current, wristX, wristY, '#FF6B6B', 16);
          }
        });
      }

      updateAndDrawParticles(ctx, particlesRef.current);

      ctx.restore();
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
      particlesRef.current = [];
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

      <p style={{ color: '#666', fontSize: 14, lineHeight: 1.7 }}>
        Кулак/долоня + висота руки — гучність фону · ліво-право — нота · розмах пальців — тембр<br />
        <b>Щипок великим до кожного пальця</b> — грає ноту гами (вказівний=корінь, середній=терція, безіменний=квінта, мізинець=октава)<br />
        <b>Жест "перемога" (V)</b> — перкусійний удар<br />
        <b>Нахил долоні</b> — панорама (ліво/право у звуці)<br />
        <b>Наближення/віддалення руки від камери</b> — сухий звук / відлуння
      </p>

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

      <div style={{ margin: '16px 0', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Мої збережені пресети</h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Назва пресету"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', flex: 1 }}
          />
          <button
            onClick={handleSavePreset}
            style={{ padding: '8px 14px', background: '#4DC9B0', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            + Зберегти поточний
          </button>
        </div>

        {savedPresets.length === 0 && <p style={{ color: '#888' }}>Ще нема збережених пресетів</p>}

        {savedPresets.map((preset) => (
          <div
            key={preset.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #ddd' }}
          >
            <span>
              {preset.name} <span style={{ color: '#888', fontSize: 12 }}>({preset.soundType})</span>
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleSelectSavedPreset(preset.soundType)} style={{ cursor: 'pointer' }}>
                Обрати
              </button>
              <button onClick={() => handleDeletePreset(preset.id)} style={{ cursor: 'pointer', color: 'red' }}>
                Видалити
              </button>
            </div>
          </div>
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

export default Instrument;