import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Glyph from './Glyph';

type Kind = 'success' | 'error' | 'info';
type Item = { id: number; kind: Kind; text: string };
type Api = { success: (t: string) => void; error: (t: string) => void; info: (t: string) => void };

const noop = () => {};
const ToastContext = createContext<Api>({ success: noop, error: noop, info: noop });

// Усі сповіщення програми показуються тут: один вигляд, автозникання, закриття вручну,
// а скрінрідер озвучує їх (role=status для звичайних, role=alert для помилок)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const push = useCallback(
    (kind: Kind, text: string) => {
      if (!text) return;
      const id = nextId.current++;
      setItems((list) => {
        // однакове повідомлення не дублюємо
        const rest = list.filter((i) => i.text !== text);
        return [...rest, { id, kind, text }].slice(-3);
      });
      timers.current.set(id, window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 5000));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  const api = useMemo<Api>(
    () => ({ success: (t) => push('success', t), error: (t) => push('error', t), info: (t) => push('info', t) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack">
        {items.map((i) => (
          <div key={i.id} className={'toast ' + i.kind} role={i.kind === 'error' ? 'alert' : 'status'}>
            <span className="toast-text">{i.text}</span>
            <button className="icon-btn" onClick={() => dismiss(i.id)} aria-label="Закрити сповіщення">
              <Glyph name="close" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
