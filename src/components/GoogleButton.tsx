import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage, loginWithGoogle } from '../api';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type Props = {
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  onError: (message: string) => void;
};

function GoogleButton({ text = 'continue_with', onError }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!CLIENT_ID) return;
    let tries = 0;

    const init = () => {
      if (!window.google?.accounts?.id || !slotRef.current) return false;

      try {
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async (response: { credential: string }) => {
            try {
              const data = await loginWithGoogle(response.credential);
              localStorage.setItem('token', data.token);
              localStorage.setItem('user', JSON.stringify(data.user));
              navigate(localStorage.getItem('tutorialCompleted') ? '/play' : '/tutorial');
            } catch (err) {
              onErrorRef.current(getErrorMessage(err, 'Не вдалось увійти через Google'));
            }
          },
        });
        window.google.accounts.id.renderButton(slotRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text,
          width: 320,
          locale: 'uk',
        });
        setReady(true);
      } catch (err) {
        console.error('Google button error', err);
        onErrorRef.current('Не вдалось завантажити кнопку Google');
      }
      return true;
    };

    if (init()) return;
    const timer = setInterval(() => {
      tries++;
      if (init() || tries > 50) clearInterval(timer);
    }, 200);
    return () => clearInterval(timer);
  }, [navigate, text]);

  if (!CLIENT_ID) {
    return (
      <button type="button" className="btn block" disabled title="Додай VITE_GOOGLE_CLIENT_ID у файл .env">
        Google (не налаштовано)
      </button>
    );
  }

  // Google сам наповнює slotRef — тому React не повинен мати там власних дочірніх елементів
  return (
    <div className="google-slot" style={{ flexDirection: 'column', alignItems: 'center' }}>
      <div ref={slotRef} />
      {!ready && <span className="pill">Завантажуємо Google…</span>}
    </div>
  );
}

export default GoogleButton;
