import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import CalibrationWizard from '../components/CalibrationWizard';
import { IconFullscreen, IconGear } from '../components/Icons';
import { useHandTracking } from '../hooks/useHandTracking';
import { HandTracker } from '../audio/features';
import type { Calibration } from '../audio/features';
import { DEFAULT_OPTS, MODES, createMode, emptyParams, getModeMeta, normalizeModeId } from '../audio/modes';
import type { LiveParams, ModeId, ModeVoice, Opts, Spawn } from '../audio/modes';
import { NOTE_NAMES, SCALES, createReverbImpulse } from '../audio/music';
import type { ScaleId } from '../audio/music';
import { createPreset, getErrorMessage, getSounds, markPresetUsed, updatePreset, uploadRecording, uploadUrl } from '../api';
import type { ApiPreset, ApiSound } from '../api';
import { fetchCalibration, loadCachedCalibration, persistCalibration } from '../lib/calibration';
import { formatDuration } from '../lib/format';

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

  // ---------- ref-и (їх читає аудіо-код у кожному кадрі) ----------
  const stageRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
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
        setOpts({
          scale: (s.scale as ScaleId) in SCALES ? (s.scale as ScaleId) : DEFAULT_OPTS.scale,
          root: typeof s.root === 'number' ? s.root : DEFAULT_OPTS.root,
          reverb: typeof s.reverb === 'number' ? s.reverb : DEFAULT_OPTS.reverb,
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
    master.connect(analyser);
    analyser.connect(ctx.destination);

    const wetIn = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = createReverbImpulse(ctx);
    const wetOut = ctx.createGain();
    wetOut.gain.value = 0.7;
    wetIn.connect(conv);
    conv.connect(wetOut);
    wetOut.connect(master);

    audioCtxRef.current = ctx;
    masterRef.current = master;
    wetRef.current = wetIn;
    analyserRef.current = analyser;
    setAudioStarted(true);
  };

  // створення активного режиму (перестворюється при зміні режиму або звуку)
  useEffect(() => {
    if (!audioStarted) return;
    const ctx = audioCtxRef.current!;
    const mode = createMode(modeId, {
      ctx,
      dry: masterRef.current!,
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
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#3de8c8');
      grad.addColorStop(0.55, '#8b6cff');
      grad.addColorStop(1, '#ff4fc3');
      ctx.fillStyle = grad;

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
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  // ---------- запис ----------
  const startRecording = () => {
    const ctx = audioCtxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;

    const dest = ctx.createMediaStreamDestination();
    master.connect(dest);
    recDestRef.current = dest;

    const recorder = new MediaRecorder(dest.stream);
    recChunksRef.current = [];
    recModeRef.current = modeId;
    recStartRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const duration = Math.round((Date.now() - recStartRef.current) / 1000);
      // Safari записує в mp4, Chrome — у webm: беремо справжній тип, який видав рекордер
      const blob = new Blob(recChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      try {
        master.disconnect(dest);
      } catch {
        // вже відключено
      }
      setRecName('Моя мелодія');
      setPendingRec({ blob, duration, mode: recModeRef.current });
    };

    recorder.start();
    recorderRef.current = recorder;
    setRecSeconds(0);
    setIsRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => setRecSeconds(Math.round((Date.now() - recStartRef.current) / 1000)), 500);
    return () => clearInterval(timer);
  }, [isRecording]);

  const saveRecording = async () => {
    if (!pendingRec) return;
    setRecSaving(true);
    try {
      await uploadRecording(recName.trim() || 'Без назви', pendingRec.blob, pendingRec.mode, pendingRec.duration);
      setPendingRec(null);
      setNotice('Запис збережено! Він з’явиться у розділі «Записи».');
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
    markModified();
  };

  const changeOpts = (patch: Partial<Opts>) => {
    setOpts((o) => ({ ...o, ...patch }));
    markModified();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  };

  const canFullscreen = typeof document.documentElement.requestFullscreen === 'function';

  const instrumentSounds = useMemo(() => sounds.filter((s) => s.type === 'instrument'), [sounds]);
  const backgroundSounds = useMemo(() => sounds.filter((s) => s.type === 'background'), [sounds]);

  const params: [string, string, number, string][] = [
    [meta.paramLabels[0], live.freq || modeId === 'chord' || modeId === 'percussive' ? live.pitchLabel : '—', live.pitch, '#3de8c8'],
    [meta.paramLabels[1], `${Math.round(Math.min(live.volume, 1) * 100)}%`, Math.min(live.volume, 1), '#8b6cff'],
    [meta.paramLabels[2], `${Math.round(live.timbre * 100)}%`, live.timbre, '#ffb347'],
    [meta.paramLabels[3], `${Math.round(live.fx * 100)}%`, live.fx, '#ff4fc3'],
  ];
  if (live.freq > 0 && modeId !== 'chord' && modeId !== 'percussive') {
    params[0][1] = `${live.pitchLabel} · ${Math.round(live.freq)} Гц`;
  }

  const cameraText =
    status === 'ready' ? `Камера підключена · ${fps} FPS` : status === 'error' ? 'Камера недоступна' : 'Запускаємо камеру…';

  return (
    <>
      <PageHeader crumb="Інструмент / Жива сесія" title="Грати">
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
          <div className="ok-box" style={{ marginTop: 0, marginBottom: 18, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>{notice}</span>
            <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setNotice('')}>
              ✕
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
                    ▶ Увімкнути звук
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

            {showSettings && (
              <div className="settings-pop">
                <div className="panel-head" style={{ marginBottom: 6 }}>
                  <h3>Налаштування звуку</h3>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setShowSettings(false)}>
                    ✕
                  </button>
                </div>

                <label className="field">Гама</label>
                <select className="select" value={opts.scale} onChange={(e) => changeOpts({ scale: e.target.value as ScaleId })}>
                  {Object.entries(SCALES).map(([id, s]) => (
                    <option key={id} value={id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <label className="field">Тональність</label>
                <select className="select" value={opts.root} onChange={(e) => changeOpts({ root: Number(e.target.value) })}>
                  {NOTE_NAMES.map((n, i) => (
                    <option key={n} value={i}>
                      {n}
                    </option>
                  ))}
                </select>

                <label className="field">Реверб: {opts.reverb}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opts.reverb}
                  style={{ ['--fill' as string]: `${opts.reverb}%` }}
                  onChange={(e) => changeOpts({ reverb: Number(e.target.value) })}
                />

                <label className="field">Власний звук інструмента</label>
                <select className="select" value={soundId} onChange={(e) => { setSoundId(e.target.value); markModified(); }}>
                  <option value="">Стандартний синтез</option>
                  {instrumentSounds.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <label className="field">Фонова петля</label>
                <select className="select" value={backgroundId} onChange={(e) => { setBackgroundId(e.target.value); markModified(); }}>
                  <option value="">Без фону</option>
                  {backgroundSounds.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {sounds.length === 0 && (
                  <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                    Власні звуки можна завантажити в розділі «Звуки».
                  </p>
                )}
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
                <div className="swatch" style={{ background: `linear-gradient(135deg, ${meta.color}, #8b6cff)` }} />
                <div>
                  <small>Активний режим</small>
                  <strong>{meta.name}</strong>
                </div>
              </div>
              <button className="stage-btn" title="Налаштування звуку" onClick={() => setShowSettings((v) => !v)}>
                <IconGear />
              </button>
              {canFullscreen && (
                <button className="stage-btn" title="На весь екран" onClick={toggleFullscreen}>
                  <IconFullscreen />
                </button>
              )}
              {isRecording ? (
                <button className="btn rec rec-btn" onClick={stopRecording}>
                  ■ Стоп
                </button>
              ) : (
                <button className="btn rec rec-btn" onClick={startRecording} disabled={!audioStarted}>
                  ● Записати
                </button>
              )}
            </div>
          </div>

          {/* ---------- права панель ---------- */}
          <div>
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
                <span className="mini-tag" style={{ ['--c' as string]: '#8b6cff' }}>
                  {audioCtxRef.current ? `${(audioCtxRef.current.sampleRate / 1000).toFixed(1)} кГц` : 'звук вимкнено'}
                </span>
              </div>
              <canvas ref={waveRef} className="wave-canvas" width={600} height={84} />
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Швидкий вибір режиму</h3>
                <a href="#modes" onClick={(e) => { e.preventDefault(); navigate('/modes'); }} className="mono" style={{ fontSize: 12 }}>
                  Усі →
                </a>
              </div>
              <div className="mode-list">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    className={'mode-row' + (m.id === modeId ? ' active' : '')}
                    style={{ ['--c' as string]: m.color }}
                    onClick={() => changeMode(m.id)}
                  >
                    <span className="sw" />
                    <span className="name">{m.name}</span>
                    {m.id === modeId && <span className="mini-tag" style={{ ['--c' as string]: m.color }}>активний</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="action-row">
              <button
                className="btn primary"
                style={{ padding: 15 }}
                disabled={!audioStarted}
                onClick={() => { setPresetName(''); setSaveError(''); setShowSave(true); }}
              >
                ⬇ Зберегти пресет
              </button>
              <button className="btn" style={{ padding: 15 }} onClick={() => setCalibrating(true)} disabled={calibrating}>
                ≡ Калібрувати
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
          <label className="field">Назва мелодії</label>
          <input className="input" value={recName} autoFocus onChange={(e) => setRecName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveRecording()} />
        </Modal>
      )}
    </>
  );
}

export default Instrument;
