import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useHandTracking } from '../hooks/useHandTracking';
import { isOpenPalm, isFist, isPeaceSign, isPinch, getTilt, getOpennessRatio } from '../utils/gestureChecks';
import { loadCachedCalibration } from '../lib/calibration';

const HOLD_MS = 800;

type Step = {
  id: string;
  title: string;
  instruction: string;
  check: (landmarks: any[]) => boolean;
};

const STEPS: Step[] = [
  { id: 'open', title: 'Розкрий долоню', instruction: 'Покажи камері повністю розкриту долоню з розведеними пальцями', check: isOpenPalm },
  { id: 'fist', title: 'Стисни в кулак', instruction: 'Тепер стисни пальці в кулак', check: isFist },
  { id: 'pinch', title: 'Зроби щипок', instruction: 'З’єднай великий і вказівний палець разом', check: isPinch },
  { id: 'peace', title: 'Покажи жест «перемога»', instruction: 'Випрями вказівний і середній палець, решту зігни (як літера V)', check: isPeaceSign },
  { id: 'tilt', title: 'Нахили долоню', instruction: 'Поверни зап’ясток так, щоб рука нахилилась убік', check: (lm) => Math.abs(getTilt(lm)) > 0.5 },
];

function Tutorial() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [debugValue, setDebugValue] = useState<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const isFinished = currentStep >= STEPS.length;

  const { videoRef, canvasRef, status, aspect } = useHandTracking((handsFound) => {
    if (isFinished || handsFound.length === 0) {
      holdStartRef.current = null;
      setProgress(0);
      return;
    }

    const landmarks = handsFound[0];
    setDebugValue(getOpennessRatio(landmarks));
    const step = STEPS[currentStep];
    if (!step) return;

    if (step.check(landmarks)) {
      if (holdStartRef.current === null) holdStartRef.current = performance.now();
      const elapsed = performance.now() - holdStartRef.current;
      setProgress(Math.min(elapsed / HOLD_MS, 1));

      if (elapsed >= HOLD_MS) {
        holdStartRef.current = null;
        setProgress(0);
        setCompleted((prev) => [...prev, step.id]);
        setCurrentStep((prev) => prev + 1);
      }
    } else {
      holdStartRef.current = null;
      setProgress(0);
    }
  }, loadCachedCalibration().confidence);

  const finish = () => {
    localStorage.setItem('tutorialCompleted', 'true');
    navigate('/play');
  };

  return (
    <>
      <PageHeader crumb="Допомога / Туторіал" title="Як грати">
        {!isFinished && (
          <button className="btn" onClick={finish}>
            Пропустити туторіал
          </button>
        )}
      </PageHeader>

      <div className="page-body">
        <div className="tut-grid">
          <div>
            <div className="stage" style={{ aspectRatio: String(aspect), width: `min(100%, calc(75svh * ${aspect}))` }}>
              <video ref={videoRef} playsInline muted />
              <canvas ref={canvasRef} width={640} height={480} />
              <div className={'stage-badge tl' + (status === 'ready' ? '' : ' idle')}>
                <span className={'dot' + (status === 'ready' ? '' : status === 'error' ? ' off' : ' wait')} />
                {status === 'ready' ? 'Камера активна' : status === 'error' ? 'Камера недоступна' : 'Запускаємо камеру…'}
              </div>
            </div>
            {debugValue !== null && !isFinished && (
              <p className="hint" style={{ marginTop: 12 }}>
                Відкритість руки: <b className="mono">{debugValue.toFixed(2)}</b> (для «розкрита» треба понад 1.6, для «кулак» менше 1.3)
              </p>
            )}
          </div>

          <div>
            {isFinished ? (
              <div className="card finish-box">
                <h2>🎉 Чудово, базові жести освоєно!</h2>
                <p>Тепер можна переходити до гри. Режими й налаштування чекають на сторінці «Грати».</p>
                <button className="btn primary" style={{ padding: '14px 28px' }} onClick={finish}>
                  Перейти до гри →
                </button>
              </div>
            ) : (
              <div className="card">
                <h2 className="card-title">{STEPS[currentStep].title}</h2>
                <p className="hint">{STEPS[currentStep].instruction}. Утримуй жест, поки шкала не заповниться.</p>
                <div className="progress">
                  <i style={{ width: `${progress * 100}%` }} />
                </div>

                <div className="step-list" style={{ marginTop: 22, marginBottom: 0 }}>
                  {STEPS.map((step, i) => {
                    const done = completed.includes(step.id);
                    return (
                      <div key={step.id} className={'step-item' + (done ? ' done' : i === currentStep ? ' cur' : '')}>
                        <span className="num">{done ? '✓' : i + 1}</span>
                        {step.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Tutorial;
