import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MODES } from '../audio/modes';

// Підвал: велика назва і випадкова порада з режимів
function Footer() {
  const tip = useMemo(() => {
    const list = MODES.filter((m) => m.tip);
    return list[Math.floor(Math.random() * list.length)];
  }, []);

  return (
    <footer className="foot">
      <div className="foot-tip" style={{ ['--c' as string]: tip.color }}>
        <b>Порада: {tip.name}</b>
        <p>{tip.tip}</p>
        <Link to="/modes">Усі режими</Link>
      </div>
      <div className="foot-big" aria-hidden="true">
        Gesture<br />Sound
      </div>
    </footer>
  );
}

export default Footer;
