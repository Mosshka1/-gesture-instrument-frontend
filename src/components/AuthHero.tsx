function AuthHero() {
  // Стилізована рука з "скелетом" — замість фото з макета
  const joints: [number, number][] = [
    [250, 470], [215, 405], [195, 345], [182, 290], [170, 245],
    [255, 330], [262, 262], [268, 205], [272, 160],
    [290, 325], [305, 250], [315, 190], [322, 140],
    [320, 340], [345, 275], [360, 225], [370, 182],
    [345, 365], [378, 315], [398, 278], [412, 245],
  ];
  const lines: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17],
  ];
  const tips = [4, 8, 12, 16, 20];

  return (
    <div className="hero-card">
      <svg className="hand" viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform="translate(70 40) scale(1.05)" filter="url(#glow)">
          {lines.map(([a, b], i) => (
            <line key={i} x1={joints[a][0]} y1={joints[a][1]} x2={joints[b][0]} y2={joints[b][1]} stroke="#3de8c8" strokeWidth="3.5" strokeLinecap="round" />
          ))}
          {joints.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={tips.includes(i) ? 8 : 5.5} fill={tips.includes(i) ? '#c6f23a' : '#fff'} />
          ))}
        </g>
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} cx={90 + i * 150} cy={560 + (i % 2) * 20} r={2 + i} fill="#8b6cff" opacity={0.5} />
        ))}
      </svg>

      <div className="hero-chip">
        <span className="dot" /> РЕАЛЬНИЙ ЧАС · ТРЕКІНГ 30+ FPS
      </div>
      <div className="hero-chip second">ТОН: A3 · ГУЧН.: 72%</div>

      <div className="hero-text">
        <div className="kicker">Твій інструмент, налаштований під тебе</div>
        <p>Чутливість, калібрування та жести прив’язані до акаунта — не потрібно налаштовувати все заново під час кожного заходу.</p>
      </div>
    </div>
  );
}

export default AuthHero;
