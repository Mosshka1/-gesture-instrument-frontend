// Маленький салют кольорами «друку»: DOM-частинки на Web Animations API, без бібліотек
const COLORS = ['#ff4f9a', '#2d5bff', '#ffd60a', '#ff6a1f', '#14b86a', '#00a99d'];

export function confetti(x = window.innerWidth / 2, y = window.innerHeight / 3, count = 42) {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  } catch {
    /* ignore */
  }
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden';
  document.body.appendChild(layer);
  let left = count;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i');
    const size = 7 + Math.random() * 9;
    const round = Math.random() < 0.35;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${round ? size : size * 0.5}px;background:${COLORS[i % COLORS.length]};border:2px solid #14173d;border-radius:${round ? '50%' : '2px'}`;
    layer.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 240;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 80;
    const anim = el.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.15}px,${dy + 320}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
    );
    anim.onfinish = () => {
      if (--left === 0) layer.remove();
    };
  }
}
