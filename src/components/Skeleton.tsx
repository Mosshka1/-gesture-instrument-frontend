// Заглушка зі «світлою хвилею», поки дані завантажуються
function Skeleton({ rows = 3, height = 84 }: { rows?: number; height?: number }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Завантажуємо">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

export default Skeleton;
