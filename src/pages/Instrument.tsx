import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import CalibrationWizard from '../components/CalibrationWizard';
import LooperPanel from '../components/LooperPanel';
import ModeGuide from '../components/ModeGuide';
import SoundPanel from '../components/SoundPanel';
import Sheet from '../components/Sheet';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Looper } from '../audio/looper';
import { IconFullscreen, IconGear } from '../components/Icons';
import { useHandTracking } from '../hooks/useHandTracking';
import { HandTracker } from '../audio/features';
import type { Calibration } from '../audio/features';
import { DEFAULT_OPTS, MODES, createMode, emptyParams, getModeMeta, normalizeModeId } from '../audio/modes';
import type { LiveParams, ModeId, ModeVoice, Opts, Spawn } from '../audio/modes';
import { SCALES, createReverbImpulse } from '../audio/music';
import type { ScaleId } from '../audio/music';
import { createPreset, getErrorMessage, getSounds, markPresetUsed, updatePreset, uploadRecording, uploadUrl } from '../api';
import type { ApiPreset, ApiSound } from '../api';
import { fetchCalibration, loadCachedCalibration, persistCalibration } from '../lib/calibration';
import { formatBytes, formatDuration } from '../lib/format';
import { confetti } from '../utils/confetti';
import Glyph from '../components/Glyph';

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function Instrument() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------- стан ----------
  const [audioStarted, setAudioStarted] = useState(false);
  const [modeId, setModeId] = useState<ModeId>(() => normalizeModeId(localStorage.getItem('selectedMode')));
  const [opts, setOpts] = useState<Opts>(() => readJson<Opts>('playOpts', DEFAULT_OPTS));
  const [cal, setCal] = useState<Calibration>(() => loadCachedCalibration());
  const [sessionPreset, setSessionPreset] = useState<{ id: number; name: string } | null>(null);
  const [sounds, setSounds] = useState<ApiSound[]>([]);
  const [soundId, setSoundId] = useState<string>(() => localStorage.getItem('selectedSoundId') || '');
  const [backgroundId, setBackgroundId] = useState<string>(() => localStorage.getItem('selectedBackgroundId') || '');
  const [sampleVersion, setSampleVersion] = useState(0);
  const [live, setLive] = useState<LiveParams>(emptyParams());
  const [showSettings, setShowSettings] = useState(false);
  const [introFor, setIntroFor] = useState<ModeId | null>(null);
  const isMobile = useMediaQuery('(max-width: 820px), (max-height: 520px)');
  const [calibrating, setCalibrating] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [pendingRec, setPendingRec] = useState<{ blob: Blob; duration: number; mode: ModeId } | null>(null);
  const [recName, setRecName] = useState('');
  const [recSaving, setRecSaving] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  const [looper, setLooper] = useState<Looper | null>(null);
  const [looperVersion, setLooperVersion] = useState(0);

  // ---------- ref-и (їх читає аудіо-код у кожному кадрі) ----------
  const stageRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const outRef = useRef<GainNode | null>(null); // фінальний вихід після ефектів: звідси йде запис
  const fxRef = useRef<{ tone: BiquadFilterNode; echoSend: GainNode; fb: GainNode; out: GainNode; wetOut: GainNode } | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const instRef = useRef<GainNode | null>(null);
  const looperRef = useRef<Looper | null>(null);
  const wetRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const modeRef = useRef<ModeVoice | null>(null);
  const trackerRef = useRef(new HandTracker());
  const particlesRef = useRef<Particle[]>([]);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const calRef = useRef(cal);
  calRef.current = cal;
  const sampleRef = useRef<AudioBuffer | null>(null);
  const liveRef = useRef<LiveParams>(emptyParams());
  const lastLandmarksRef = useRef<any[] | null>(null);
  const presetOverrideRef = useRef<Partial<Calibration>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef(0);
  const recModeRef = useRef<ModeId>(modeId);
  const recDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const bgSourceRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null);

  const meta = getModeMeta(modeId);

  // ---------- трекінг руки ----------
  const { videoRef, canvasRef, status, fps, aspect } = useHandTracking((handsLm, ctx2d, canvas) => {
    const now = performance.now();
    lastLandmarksRef.current = handsLm.length ? handsLm[0] : null;
    const hands = trackerRef.current.process(handsLm, calRef.current, now);

    const mode = modeRef.current;
    let spawns: Spawn[] = [];
    if (mode) {
      spawns = mode.update(hands, now);
      mode.drawOverlay?.(ctx2d, canvas.width, canvas.height);
      liveRef.current = mode.params;
    } else {
      const p = emptyParams();
      p.hands = hands.length;
      if (hands.length) {
        p.gesture = hands[0].f.gesture;
        p.fingers = hands[0].f.fingers;
        p.hint = 'Натисни «Увімкнути звук», щоб почути інструмент';
      }
      liveRef.current = p;
    }

    spawns.forEach((s) => {
      for (let i = 0; i < s.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3.2;
        particlesRef.current.push({
          x: s.x * canvas.width,
          y: s.y * canvas.height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: s.color,
        });
      }
    });

    const particles = particlesRef.current;
    ctx2d.save();
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
      ctx2d.globalAlpha = Math.max(p.life, 0);
      ctx2d.fillStyle = p.color;
      ctx2d.shadowColor = p.color;
      ctx2d.shadowBlur = 10;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx2d.fill();
    }
    ctx2d.restore();
  }, cal.confidence);

  // ---------- початкове завантаження ----------
  useEffect(() => {
    // застосовуємо пресет, вибраний на сторінці "Пресети"
    try {
      const raw = localStorage.getItem('activePreset');
      if (raw) {
        const preset = JSON.parse(raw) as ApiPreset;
        const s = preset.settings || {};
        const m = normalizeModeId(preset.soundType);
        setModeId(m);
        const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d);
        setOpts({
          scale: (s.scale as ScaleId) in SCALES ? (s.scale as ScaleId) : DEFAULT_OPTS.scale,
          root: num(s.root, DEFAULT_OPTS.root),
          reverb: num(s.reverb, DEFAULT_OPTS.reverb),
          echo: num(s.echo, DEFAULT_OPTS.echo),
          tone: num(s.tone, DEFAULT_OPTS.tone),
          volume: num(s.volume, DEFAULT_OPTS.volume),
          wave: ['auto', 'sine', 'triangle', 'square', 'sawtooth'].includes(s.wave) ? s.wave : DEFAULT_OPTS.wave,
        });
        setSoundId(s.soundId ? String(s.soundId) : '');
        setBackgroundId(s.backgroundId ? String(s.backgroundId) : '');
        const override: Partial<Calibration> = {};
        if (typeof s.sensitivity === 'number') override.sensitivity = s.sensitivity;
        if (typeof s.smoothing === 'number') override.smoothing = s.smoothing;
        presetOverrideRef.current = override;
        setCal((c) => ({ ...c, ...override }));
        setSessionPreset({ id: preset.id, name: preset.name });
      }
    } catch {
      // пошкоджений запис — ігноруємо
    }

    fetchCalibration().then((remote) => setCal({ ...remote, ...presetOverrideRef.current }));
    getSounds()
      .then(setSounds)
      .catch(() => setSounds([]));

    if (searchParams.get('calibrate')) {
      setCalibrating(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // збереження вибору між відвідуваннями
  useEffect(() => {
    localStorage.setItem('selectedMode', modeId);
  }, [modeId]);
  useEffect(() => {
    localStorage.setItem('playOpts', JSON.stringify(opts));
  }, [opts]);
  useEffect(() => {
    localStorage.setItem('selectedSoundId', soundId);
  }, [soundId]);
  useEffect(() => {
    localStorage.setItem('selectedBackgroundId', backgroundId);
  }, [backgroundId]);

  const markModified = () => {
    localStorage.removeItem('activePreset');
  };

  // ---------- аудіо ----------
  const startAudio = () => {
    if (audioCtxRef.current) return;
    const ctx = new AudioContext();
    ctx.resume().catch(() => {});
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;

    // ефекти на виході: яскравість (фільтр), ехо (затримка із зворотним зв’язком) і загальна гучність
    const toneF = ctx.createBiquadFilter();
    toneF.type = 'lowpass';
    toneF.frequency.value = 18000;
    toneF.Q.value = 0.5;
    const out = ctx.createGain();
    const echoSend = ctx.createGain();
    echoSend.gain.value = 0;
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.36;
    const echoLP = ctx.createBiquadFilter();
    echoLP.type = 'lowpass';
    echoLP.frequency.value = 3200;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    master.connect(toneF);
    toneF.connect(out);
    toneF.connect(echoSend);
    echoSend.connect(delay);
    delay.connect(echoLP);
    echoLP.connect(out);
    echoLP.connect(fb);
    fb.connect(delay);
    out.connect(analyser);
    analyser.connect(ctx.destination);

    const wetIn = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = createReverbImpulse(ctx);
    const wetOut = ctx.createGain();
    wetOut.gain.value = 0.7;
    wetIn.connect(conv);
    conv.connect(wetOut);
    // весь звук інструмента проходить через instOut: звідси лупер записує шари (без самих петель)
    const instOut = ctx.createGain();
    instOut.connect(master);
    wetOut.connect(instOut);

    audioCtxRef.current = ctx;
    masterRef.current = master;
    outRef.current = out;
    fxRef.current = { tone: toneF, echoSend, fb, out, wetOut };
    instRef.current = instOut;
    const lp = new Looper(ctx, instOut, master, () => setLooperVersion((v) => v + 1));
    looperRef.current = lp;
    setLooper(lp);
    wetRef.current = wetIn;
    analyserRef.current = analyser;
    setAudioStarted(true);
    setIntroFor(modeId);
  };

  // ефекти реагують на повзунки відразу
  useEffect(() => {
    const fx = fxRef.current;
    const ctx = audioCtxRef.current;
    if (!fx || !ctx) return;
    const t = ctx.currentTime;
    fx.tone.frequency.setTargetAtTime(400 * Math.pow(45, opts.tone / 100), t, 0.05);
    fx.echoSend.gain.setTargetAtTime((opts.echo / 100) * 0.85, t, 0.05);
    fx.fb.gain.setTargetAtTime(0.28 + (opts.echo / 100) * 0.32, t, 0.05);
    fx.out.gain.setTargetAtTime(opts.volume / 85, t, 0.05);
    fx.wetOut.gain.setTargetAtTime(0.3 + 0.8 * (opts.reverb / 100), t, 0.05);
  }, [opts, audioStarted]);

  // коротка підказка на сцені при зміні режиму
  useEffect(() => {
    if (!introFor) return;
    const t = setTimeout(() => setIntroFor(null), 9000);
    return () => clearTimeout(t);
  }, [introFor]);

  // створення активного режиму (перестворюється при зміні режиму або звуку)
  useEffect(() => {
    if (!audioStarted) return;
    const ctx = audioCtxRef.current!;
    const mode = createMode(modeId, {
      ctx,
      dry: instRef.current!,
      wet: wetRef.current!,
      getOpts: () => optsRef.current,
      getCal: () => calRef.current,
      getSample: () => sampleRef.current,
    });
    modeRef.current = mode;
    trackerRef.current.reset();
    return () => {
      mode.stop();
      if (modeRef.current === mode) modeRef.current = null;
    };
  }, [audioStarted, modeId, sampleVersion]);

  // завантаження вибраного власного звуку як семпла
  useEffect(() => {
    if (!audioStarted) return;
    const sound = sounds.find((s) => String(s.id) === soundId && s.type === 'instrument');
    let cancelled = false;
    if (!sound) {
      if (sampleRef.current) {
        sampleRef.current = null;
        setSampleVersion((v) => v + 1);
      }
      return;
    }
    fetch(uploadUrl(sound.fileName))
      .then((r) => r.arrayBuffer())
      .then((data) => audioCtxRef.current!.decodeAudioData(data))
      .then((buffer) => {
        if (cancelled) return;
        sampleRef.current = buffer;
        setSampleVersion((v) => v + 1);
      })
      .catch(() => {
        if (!cancelled) setNotice('Не вдалось завантажити власний звук — граємо стандартним');
      });
    return () => {
      cancelled = true;
    };
  }, [audioStarted, soundId, sounds]);

  // фонова петля
  useEffect(() => {
    if (!audioStarted) return;
    const sound = sounds.find((s) => String(s.id) === backgroundId && s.type === 'background');
    let cancelled = false;

    const stopBg = () => {
      const bg = bgSourceRef.current;
      if (bg) {
        try {
          bg.src.stop();
        } catch {
          // вже зупинено
        }
        bg.gain.disconnect();
        bgSourceRef.current = null;
      }
    };
    stopBg();
    if (!sound) return;

    fetch(uploadUrl(sound.fileName))
      .then((r) => r.arrayBuffer())
      .then((data) => audioCtxRef.current!.decodeAudioData(data))
      .then((buffer) => {
        if (cancelled || !audioCtxRef.current || !masterRef.current) return;
        const ctx = audioCtxRef.current;
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = 0.35;
        src.buffer = buffer;
        src.loop = true;
        src.connect(gain);
        gain.connect(masterRef.current);
        src.start();
        bgSourceRef.current = { src, gain };
      })
      .catch(() => {
        if (!cancelled) setNotice('Не вдалось завантажити фоновий звук');
      });
    return () => {
      cancelled = true;
      stopBg();
    };
  }, [audioStarted, backgroundId, sounds]);

  // оновлення панелі параметрів ~8 разів на секунду
  useEffect(() => {
    const timer = setInterval(() => setLive({ ...liveRef.current }), 125);
    return () => clearInterval(timer);
  }, []);

  // малювання хвилі
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = waveRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bars = 32;
      const data = new Uint8Array(analyserRef.current ? analyserRef.current.frequencyBinCount : 0);
      if (analyserRef.current) analyserRef.current.getByteFrequencyData(data);

      const gap = 4;
      const bw = (w - gap * (bars - 1)) / bars;
      ctx.fillStyle = '#ffd60a';

      for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i / bars) * Math.min(data.length, 56));
        const v = data.length ? data[idx] / 255 : 0;
        const bh = Math.max(5, v * (h - 6));
        ctx.beginPath();
        ctx.roundRect(i * (bw + gap), (h - bh) / 2, bw, bh, 3);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // прибирання при виході зі сторінки
  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.state === 'recording' && recorderRef.current.stop();
      } catch {
        // ігноруємо
      }
      bgSourceRef.current?.src.stop?.();
      looperRef.current?.dispose();
      looperRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  // ---------- запис ----------
  const MAX_REC_SECONDS = 300;

  // обираємо формат, який справді вміє записувати цей браузер (Chrome — webm, Safari — mp4)
  const pickRecorderMime = () => {
    const variants = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return variants.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
  };

  const startRecording = async () => {
    const ctx = audioCtxRef.current;
    const master = outRef.current;
    if (!ctx || !master || recorderRef.current?.state === 'recording') return;
    if (typeof MediaRecorder === 'undefined') {
      setNotice('Цей браузер не підтримує запис звуку');
      return;
    }

    // на телефонах контекст може бути призупинений — тоді запис вийде тихим
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        // спробуємо все одно
      }
    }

    const dest = ctx.createMediaStreamDestination();
    master.connect(dest);
    recDestRef.current = dest;

    let recorder: MediaRecorder;
    try {
      const mimeType = pickRecorderMime();
      recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined);
    } catch {
      master.disconnect(dest);
      setNotice('Не вдалось почати запис у цьому браузері');
      return;
    }
    recChunksRef.current = [];
    recModeRef.current = modeId;
    recStartRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recChunksRef.current.push(e.data);
    };
    recorder.onerror = () => {
      setNotice('Під час запису сталась помилка');
      setIsRecording(false);
    };
    recorder.onstop = () => {
      const duration = Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000));
      // Safari записує в mp4, Chrome — у webm: беремо справжній тип, який видав рекордер
      const blob = new Blob(recChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      try {
        master.disconnect(dest);
      } catch {
        // вже відключено
      }
      recorderRef.current = null;
      if (blob.size < 1024 || Date.now() - recStartRef.current < 800) {
        setNotice('Запис вийшов занадто коротким — спробуй ще раз');
        return;
      }
      setRecName('Моя мелодія');
      setPendingRec({ blob, duration, mode: recModeRef.current });
    };

    // timeslice: дані віддаються частинами, тож нічого не губиться, якщо вкладку закрито
    recorder.start(1000);
    recorderRef.current = recorder;
    setRecSeconds(0);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setIsRecording(false);
  };

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => {
      const sec = Math.round((Date.now() - recStartRef.current) / 1000);
      setRecSeconds(sec);
      if (sec >= MAX_REC_SECONDS) {
        setNotice('Досягнуто ліміт запису — 5 хвилин. Запис зупинено.');
        stopRecording();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [isRecording]);

  // попереднє прослуховування перед збереженням
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    if (!pendingRec) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(pendingRec.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingRec]);

  const saveRecording = async () => {
    if (!pendingRec) return;
    setRecSaving(true);
    try {
      await uploadRecording(recName.trim() || 'Без назви', pendingRec.blob, pendingRec.mode, pendingRec.duration);
      setPendingRec(null);
      setNotice('Запис збережено! Він з’явиться у розділі «Записи».');
      confetti();
    } catch (err) {
      setNotice(getErrorMessage(err, 'Не вдалось зберегти запис'));
    } finally {
      setRecSaving(false);
    }
  };

  // не даємо екрану телефона згасати під час гри
  useEffect(() => {
    if (!audioStarted) return;
    let lock: any = null;
    let cancelled = false;
    const request = async () => {
      try {
        const wl = (navigator as any).wakeLock;
        if (wl && !cancelled && document.visibilityState === 'visible') lock = await wl.request('screen');
      } catch {
        // не підтримується або відхилено — нічого страшного
      }
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch?.(() => {});
    };
  }, [audioStarted]);

  // ---------- пресети ----------
  const buildSettings = () => ({
    mode: modeId,
    scale: opts.scale,
    root: opts.root,
    reverb: opts.reverb,
    echo: opts.echo,
    tone: opts.tone,
    volume: opts.volume,
    wave: opts.wave,
    soundId: soundId ? Number(soundId) : null,
    backgroundId: backgroundId ? Number(backgroundId) : null,
    sensitivity: cal.sensitivity,
    smoothing: cal.smoothing,
  });

  const savePresetNew = async () => {
    if (!presetName.trim()) {
      setSaveError('Дай пресету назву');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const preset = await createPreset(presetName.trim(), modeId, buildSettings());
      setSessionPreset({ id: preset.id, name: preset.name });
      setShowSave(false);
      setNotice(`Пресет «${preset.name}» збережено`);
      confetti();
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const savePresetUpdate = async () => {
    if (!sessionPreset) return;
    setSaving(true);
    setSaveError('');
    try {
      const preset = await updatePreset(sessionPreset.id, { soundType: modeId, settings: buildSettings() });
      await markPresetUsed(preset.id).catch(() => {});
      setShowSave(false);
      setNotice(`Пресет «${preset.name}» оновлено`);
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ---------- калібрування ----------
  const finishCalibration = useCallback(
    async (result: { palmRatio: number; fistRatio: number; sizeFar: number; sizeNear: number }) => {
      const next: Calibration = { ...calRef.current, ...result, calibrated: true, calibratedAt: new Date().toISOString() };
      setCal(next);
      try {
        await persistCalibration(next);
      } catch {
        setNotice('Калібрування діє зараз, але не вдалось зберегти його в акаунті');
      }
    },
    []
  );

  // ---------- допоміжне для відображення ----------
  const changeMode = (id: ModeId) => {
    setModeId(id);
    setIntroFor(id);
    markModified();
  };

  const changeOpts = (patch: Partial<Opts>) => {
    setOpts((o) => ({ ...o, ...patch }));
    markModified();
  };

  // гарячі клавіші: 1–9 — режими, R — запис
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName) && e.key === ' ')) return;
      if (el && (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (document.querySelector('.modal-backdrop, .sheet-backdrop')) return;
      if (/^[1-9]$/.test(e.key)) {
        const m = MODES[Number(e.key) - 1];
        if (m) changeMode(m.id);
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        if (isRecording) stopRecording();
        else if (audioStarted) startRecording();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  };

  const canFullscreen = typeof document.documentElement.requestFullscreen === 'function';

  const instrumentSounds = useMemo(() => sounds.filter((s) => s.type === 'instrument'), [sounds]);
  const backgroundSounds = useMemo(() => sounds.filter((s) => s.type === 'background'), [sounds]);

  const params: [string, string, number, string][] = [
    [meta.paramLabels[0], live.freq || modeId === 'chord' || modeId === 'percussive' ? live.pitchLabel : '—', live.pitch, '#ff4f9a'],
    [meta.paramLabels[1], `${Math.round(Math.min(live.volume, 1) * 100)}%`, Math.min(live.volume, 1), '#ffd60a'],
    [meta.paramLabels[2], `${Math.round(live.timbre * 100)}%`, live.timbre, '#ff6a1f'],
    [meta.paramLabels[3], `${Math.round(live.fx * 100)}%`, live.fx, '#14b86a'],
  ];
  if (live.freq > 0 && modeId !== 'chord' && modeId !== 'percussive') {
    params[0][1] = `${live.pitchLabel} · ${Math.round(live.freq)} Гц`;
  }

  const cameraText =
    status === 'ready' ? `Камера підключена · ${fps} FPS` : status === 'error' ? 'Камера недоступна' : 'Запускаємо камеру…';

  return (
    <>
      <PageHeader crumb="Камера, рука, звук" title="Грати">
        <span className="pill keep">
          <span className={'dot' + (status === 'ready' ? '' : status === 'error' ? ' off' : ' wait')} />
          {cameraText}
        </span>
        <span className="pill">
          Пресет: <b>{sessionPreset ? sessionPreset.name : 'без пресету'}</b>
        </span>
        <button className="btn sm hide-mobile" onClick={() => { setPresetName(''); setSaveError(''); setShowSave(true); }} disabled={!audioStarted}>
          Зберегти пресет
        </button>
      </PageHeader>

      <div className="page-body">
        {notice && (
          <div className="toast" role="status">
            <span>{notice}</span>
            <button className="icon-btn" onClick={() => setNotice('')} aria-label="Закрити">
              <Glyph name="close" />
            </button>
          </div>
        )}

        <div className="play-grid">
          {/* ---------- сцена з камерою ---------- */}
          <div className="stage" ref={stageRef} style={{ aspectRatio: String(aspect), width: `min(100%, calc(75svh * ${aspect}))` }}>
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} width={640} height={480} />

            <div className={'stage-badge tl' + (live.hands ? '' : ' idle')}>
              <span className={'dot' + (live.hands ? '' : ' wait')} />
              {live.hands ? 'Трекінг рук · активний' : 'Покажи руку в камеру'}
            </div>

            {isRecording && (
              <div className="stage-badge tr">
                <span className="dot off" /> REC {formatDuration(recSeconds)}
              </div>
            )}

            {live.hands > 0 && (
              <div className="stage-tooltip">
                Пальців: <b>{live.fingers} / 5</b>
                <br />
                Жест: <b>{live.gesture}</b>
              </div>
            )}

            {audioStarted && live.hands > 0 && !calibrating && (
              <div className="stage-hint">
                <b>{live.hint}</b>
              </div>
            )}

            {!audioStarted && status !== 'error' && (
              <div className="stage-overlay">
                <div>
                  <h3>Готова грати?</h3>
                  <p>Браузер дозволяє звук лише після кліку. Натисни кнопку — і рухай рукою перед камерою. На iPhone вимкни беззвучний режим (перемикач збоку), інакше звуку не буде.</p>
                  <button className="btn primary" style={{ padding: '14px 28px', fontSize: 16 }} onClick={startAudio}>
                    <Glyph name="play" /> Увімкнути звук
                  </button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="stage-overlay">
                <div>
                  <h3>Камера недоступна</h3>
                  <p>Дозволь доступ до камери в браузері (значок біля адреси) і онови сторінку. Також перевір, що камеру не використовує інша програма.</p>
                  <button className="btn" onClick={() => window.location.reload()}>
                    Оновити сторінку
                  </button>
                </div>
              </div>
            )}

            {introFor && audioStarted && !calibrating && (
              <div className="mode-intro" key={introFor} style={{ ['--c' as string]: getModeMeta(introFor).color }}>
                <button className="mi-close" onClick={() => setIntroFor(null)} aria-label="Сховати підказку">
                  <Glyph name="close" />
                </button>
                <div className="mi-title">
                  <i><Glyph name={getModeMeta(introFor).icon} /></i> {getModeMeta(introFor).name}
                </div>
                <ul>
                  {getModeMeta(introFor).howTo.slice(0, 3).map((h, i) => (
                    <li key={i}>
                      <span><Glyph name={h.icon} /></span>
                      <span>
                        <b>{h.gesture}</b> — {h.effect}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {calibrating && (
              <CalibrationWizard
                getLandmarks={() => lastLandmarksRef.current}
                onCancel={() => setCalibrating(false)}
                onDone={finishCalibration}
              />
            )}

            <div className="stage-bar">
              <div className="mode-chip">
                <div className="swatch" style={{ background: meta.color }} />
                <div>
                  <small>Активний режим</small>
                  <strong>{meta.name}</strong>
                </div>
              </div>
              <button
                className="stage-btn"
                title="Налаштування звуку"
                onClick={() => {
                  if (isMobile) setShowSettings(true);
                  else settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <IconGear />
              </button>
              {canFullscreen && (
                <button className="stage-btn" title="На весь екран" onClick={toggleFullscreen}>
                  <IconFullscreen />
                </button>
              )}
              {isRecording ? (
                <button className="btn rec recording rec-btn" onClick={stopRecording}>
                  <Glyph name="stop" /> Стоп
                </button>
              ) : (
                <button className="btn rec rec-btn" onClick={startRecording} disabled={!audioStarted}>
                  <Glyph name="rec" /> Записати
                </button>
              )}
            </div>
          </div>

          {/* ---------- права панель ---------- */}
          <div>
            <ModeGuide modeId={modeId} onChange={changeMode} onAll={() => navigate('/modes')} />

            <LooperPanel looper={looper} modeName={meta.name} version={looperVersion} />
            <div className="panel">
              <div className="panel-head">
                <h3>Параметри звуку</h3>
                <span className="mini-tag">наживо</span>
              </div>
              {params.map(([label, value, fill, color]) => (
                <div className="param" key={label} style={{ ['--c' as string]: color }}>
                  <div className="param-row">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Хвиля на виході</h3>
                <span className="mini-tag" style={{ ['--c' as string]: '#ffd60a' }}>
                  {audioCtxRef.current ? `${(audioCtxRef.current.sampleRate / 1000).toFixed(1)} кГц` : 'звук вимкнено'}
                </span>
              </div>
              <canvas ref={waveRef} className="wave-canvas" width={600} height={84} />
            </div>

            {!isMobile && (
              <div className="panel" ref={settingsRef}>
                <div className="panel-head">
                  <h3>Звук і ефекти</h3>
                  <span className="mini-tag">чути одразу</span>
                </div>
                <SoundPanel
                  opts={opts}
                  onChange={changeOpts}
                  soundId={soundId}
                  backgroundId={backgroundId}
                  onSound={(id) => {
                    setSoundId(id);
                    markModified();
                  }}
                  onBackground={(id) => {
                    setBackgroundId(id);
                    markModified();
                  }}
                  instrumentSounds={instrumentSounds}
                  backgroundSounds={backgroundSounds}
                  hasSounds={sounds.length > 0}
                />
              </div>
            )}

            <div className="action-row">
              <button
                className="btn primary"
                style={{ padding: 15 }}
                disabled={!audioStarted}
                onClick={() => { setPresetName(''); setSaveError(''); setShowSave(true); }}
              >
                <Glyph name="save" /> Зберегти пресет
              </button>
              <button className="btn" style={{ padding: 15 }} onClick={() => setCalibrating(true)} disabled={calibrating}>
                <Glyph name="sliders" /> Калібрувати
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSave && (
        <Modal
          title="Зберегти пресет"
          subtitle={`Режим: ${meta.name}. Збережуться гама, тональність, реверб, вибрані звуки та чутливість.`}
          onClose={() => setShowSave(false)}
          actions={
            <>
              <button className="btn" onClick={() => setShowSave(false)}>
                Скасувати
              </button>
              {sessionPreset && (
                <button className="btn" onClick={savePresetUpdate} disabled={saving}>
                  Оновити «{sessionPreset.name}»
                </button>
              )}
              <button className="btn primary" onClick={savePresetNew} disabled={saving}>
                {saving ? 'Зберігаємо…' : 'Зберегти як новий'}
              </button>
            </>
          }
        >
          <label className="field">Назва пресету</label>
          <input className="input" value={presetName} autoFocus onChange={(e) => setPresetName(e.target.value)} placeholder="Наприклад: Неоновий пад" onKeyDown={(e) => e.key === 'Enter' && savePresetNew()} />
          {saveError && <div className="error-box">{saveError}</div>}
        </Modal>
      )}

      {isMobile && showSettings && (
        <Sheet title="Звук і ефекти" onClose={() => setShowSettings(false)}>
          <SoundPanel
            opts={opts}
                  onChange={changeOpts}
                  soundId={soundId}
                  backgroundId={backgroundId}
                  onSound={(id) => {
                    setSoundId(id);
                    markModified();
                  }}
                  onBackground={(id) => {
                    setBackgroundId(id);
                    markModified();
                  }}
                  instrumentSounds={instrumentSounds}
                  backgroundSounds={backgroundSounds}
                  hasSounds={sounds.length > 0}
          />
        </Sheet>
      )}

      {pendingRec && (
        <Modal
          title="Зберегти запис"
          subtitle={`Тривалість ${formatDuration(pendingRec.duration)} · ${getModeMeta(pendingRec.mode).name}`}
          onClose={() => setPendingRec(null)}
          actions={
            <>
              <button className="btn" onClick={() => setPendingRec(null)}>
                Відхилити
              </button>
              <button className="btn primary" onClick={saveRecording} disabled={recSaving}>
                {recSaving ? 'Зберігаємо…' : 'Зберегти'}
              </button>
            </>
          }
        >
          {previewUrl && (
            <>
              <label className="field">Прослухай перед збереженням</label>
              <audio className="rec-preview" src={previewUrl} controls preload="metadata" />
            </>
          )}
          <label className="field">Назва мелодії</label>
          <input className="input" value={recName} autoFocus onChange={(e) => setRecName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveRecording()} />
          <p className="hint" style={{ marginBottom: 0 }}>Розмір {formatBytes(pendingRec.blob.size)}</p>
        </Modal>
      )}
    </>
  );
}

export default Instrument;
