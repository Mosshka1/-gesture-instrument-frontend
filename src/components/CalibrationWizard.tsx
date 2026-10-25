import { useEffect, useRef, useState } from 'react';
import type { Landmarks } from '../audio/features';
import { distance } from '../utils/gestureChecks';

type Props = {
  getLandmarks: () => Landmarks | null;
  onCancel: () => void;
  onDone: (result: { palmRatio: number; fistRatio: number; sizeFar: number; sizeNear: number }) => void;
};

const STEPS = [
  { title: 'Крок 1 з 4 — розкрита долоня', text: 'Покажи камері повністю розкриту долоню з розведеними пальцями й потримай.' },
  { title: 'Крок 2 з 4 — кулак', text: 'Тепер щільно стисни руку в кулак і потримай.' },
  { title: 'Крок 3 з 4 — рука далеко', text: 'Відсунь розкриту руку якнайдалі від камери (на довжину витягнутої руки).' },
  { title: 'Крок 4 з 4 — рука близько', text: 'Піднеси розкриту руку близько до камери (приблизно 20–30 см).' },
];

const SAMPLES_NEEDED = 26;

function measure(lm: Landmarks) {
  const size = distance(lm[0], lm[9]) || 0.1;
  const tips = [4, 8, 12, 16, 20].map((i) => lm[i]);
  const avg = tips.reduce((s, t) => s + distance(t, lm[0]), 0) / tips.length;
  return { ratio: avg / size, size };
}

function CalibrationWizard({ getLandmarks, onCancel, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);

  const samplesRef = useRef<number[]>([]);
  const resultRef = useRef<number[]>([]);
  const stepRef = useRef(0);
  const getRef = useRef(getLandmarks);
  getRef.current = getLandmarks;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const timer = setInterval(() => {
      if (stepRef.current >= STEPS.length) return;
      const lm = getRef.current();
      if (!lm) {
        samplesRef.current = [];
        setProgress(0);
        return;
      }
      const { ratio, size } = measure(lm);
      const s = stepRef.current;
      const value = s <= 1 ? ratio : size;

      // відсіюємо явно хибні вимірювання (наприклад, кулак на кроці "долоня")
      if (s === 0 && ratio < 1.6) {
        samplesRef.current = [];
        setProgress(0);
        return;
      }
      if (s === 1 && ratio > 1.7) {
        samplesRef.current = [];
        setProgress(0);
        return;
      }

      samplesRef.current.push(value);
      setProgress(samplesRef.current.length / SAMPLES_NEEDED);

      if (samplesRef.current.length >= SAMPLES_NEEDED) {
        const avg = samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length;
        resultRef.current[s] = avg;
        samplesRef.current = [];
        setProgress(0);

        if (s === STEPS.length - 1) {
          const [palm, fist, far, near] = resultRef.current;
          if (palm - fist < 0.35) {
            setError('Долоня і кулак вийшли надто схожими — спробуй ще раз, розкриваючи руку ширше.');
            resultRef.current = [];
            stepRef.current = 0;
            setStep(0);
            return;
          }
          if (near < far * 1.15) {
            setError('Різниця між "далеко" і "близько" замала — відсунь і піднеси руку сильніше.');
            resultRef.current = [];
            stepRef.current = 0;
            setStep(0);
            return;
          }
          stepRef.current = STEPS.length;
          setFinished(true);
          doneRef.current({
            palmRatio: palm * 0.93,
            fistRatio: fist * 1.1,
            sizeFar: far * 1.05,
            sizeNear: near * 0.95,
          });
        } else {
          setError('');
          stepRef.current = s + 1;
          setStep(s + 1);
        }
      }
    }, 50);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="calib-card">
      <div className="calib-steps">
        {STEPS.map((_, i) => (
          <i key={i} className={finished || i < step ? 'done' : i === step ? 'cur' : ''} />
        ))}
      </div>

      {finished ? (
        <>
          <h4>✓ Калібрування завершено</h4>
          <p>Налаштування збережено в акаунті й працюватимуть у всіх режимах.</p>
          <div className="modal-actions" style={{ marginTop: 14 }}>
            <button className="btn primary sm" onClick={onCancel}>
              Готово
            </button>
          </div>
        </>
      ) : (
        <>
          <h4>{STEPS[step].title}</h4>
          <p>{STEPS[step].text}</p>
          <div className="progress">
            <i style={{ width: `${Math.min(progress, 1) * 100}%` }} />
          </div>
          {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
          <div className="modal-actions" style={{ marginTop: 14 }}>
            <button className="btn sm" onClick={onCancel}>
              Скасувати
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default CalibrationWizard;
