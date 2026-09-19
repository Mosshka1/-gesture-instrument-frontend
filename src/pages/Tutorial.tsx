import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHandTracking } from '../hooks/useHandTracking';
import { isOpenPalm, isFist, isPeaceSign, isPinch, getTilt, getOpennessRatio } from '../utils/gestureChecks';

const HOLD_MS = 800;

type Step = {
  id: string;
  title: string;
  instruction: string;
  check: (landmarks: any[]) => boolean;
};

const STEPS: Step[] = [
  {
    id: 'open',
    title: 'Розкрий долоню',
    instruction: 'Покажи камері повністю розкриту долоню з розведеними пальцями',
    check: isOpenPalm,
  },
  {
    id: 'fist',
    title: 'Стисни в кулак',
    instruction: 'Тепер стисни пальці в кулак',
    check: isFist,
  },
  {
    id: 'pinch',
    title: 'Зроби щипок',
    instruction: "З'єднай великий і вказівний палець разом",
    check: isPinch,
  },
  {
    id: 'peace',
    title: 'Покажи жест "перемога"',
    instruction: 'Випрями вказівний і середній палець, решту зігни (як V)',
    check: isPeaceSign,
  },
  {
    id: 'tilt',
    title: 'Нахили долоню',
    instruction: 'Поверни зап\'ясток так, щоб рука нахилилась вбік',
    check: (landmarks) => Math.abs(getTilt(landmarks)) > 0.5,
  },
];

function Tutorial() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const holdStartRef = useRef<number | null>(null);
  const isFinished = currentStep >= STEPS.length;
  const [debugValue, setDebugValue] = useState<number | null>(null);

  const { videoRef, canvasRef } = useHandTracking((handsFound) => {
    if (isFinished || handsFound.length === 0) {
      holdStartRef.current = null;
      setProgress(0);
      return;
    }

    const landmarks = handsFound[0];
    setDebugValue(getOpennessRatio(landmarks));
    const step = STEPS[currentStep];
    if (!step) return;

    const conditionMet = step.check(landmarks);

    if (conditionMet) {
      if (holdStartRef.current === null) {
        holdStartRef.current = performance.now();
      }
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
  });

  const finishTutorial = () => {
    localStorage.setItem('tutorialCompleted', 'true');
    navigate('/play');
  };

  const skipTutorial = () => {
    localStorage.setItem('tutorialCompleted', 'true');
    navigate('/play');
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Як грати</h1>
        {!isFinished && (
          <button onClick={skipTutorial} style={{ cursor: 'pointer', background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '8px 14px' }}>
            Пропустити туторіал
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '20px 0', flexWrap: 'wrap' }}>
        {STEPS.map((step, i) => (
          <div
            key={step.id}
            style={{
              padding: '8px 14px',
              borderRadius: 20,
              fontSize: 13,
              background: completed.includes(step.id)
                ? '#4DC9B0'
                : i === currentStep
                ? '#eee'
                : '#f8f8f8',
              color: completed.includes(step.id) ? '#fff' : '#666',
              border: i === currentStep ? '2px solid #4DC9B0' : '1px solid #ddd',
            }}
          >
            {completed.includes(step.id) ? '✓ ' : ''}
            {step.title}
          </div>
        ))}
      </div>

      {isFinished ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#f5f5f5', borderRadius: 12 }}>
          <h2>🎉 Чудово, ти опанувала всі базові жести!</h2>
          <p style={{ color: '#666' }}>Тепер можеш переходити до самої гри.</p>
          <button
            onClick={finishTutorial}
            style={{ marginTop: 16, padding: '12px 24px', background: '#4DC9B0', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
          >
            Перейти до гри →
          </button>
        </div>
      ) : (
        <>
          <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 12, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>{STEPS[currentStep].title}</h3>
            <p style={{ color: '#666' }}>{STEPS[currentStep].instruction}</p>

            <div style={{ height: 8, background: '#ddd', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress * 100}%`,
                  background: '#4DC9B0',
                  transition: 'width 0.05s linear',
                }}
              />
            </div>

            {debugValue !== null && (
              <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                Дебаг: відкритість руки = {debugValue.toFixed(2)} (для "розкрита" треба більше 1.6, для "кулак" менше 1.3)
              </p>
            )}
          </div>

          <div style={{ position: 'relative', width: 480, height: 360 }}>
            <video
              ref={videoRef}
              style={{ position: 'absolute', width: 480, height: 360, transform: 'scaleX(-1)' }}
            />
            <canvas
              ref={canvasRef}
              width={480}
              height={360}
              style={{ position: 'absolute', width: 480, height: 360, transform: 'scaleX(-1)' }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default Tutorial;