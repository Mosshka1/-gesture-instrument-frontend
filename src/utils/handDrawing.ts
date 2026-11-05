export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

const TIPS = [4, 8, 12, 16, 20];

export function drawHandSkeleton(ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number) {
  ctx.save();
  ctx.lineCap = 'round';
  // друкарський стиль: темний контур під плоским кольором, без свічення
  const strokeAll = (color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    HAND_CONNECTIONS.forEach(([start, end]) => {
      const p1 = landmarks[start];
      const p2 = landmarks[end];
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    });
  };
  strokeAll('#0d0f24', 8);
  strokeAll('#ff4f9a', 4);

  landmarks.forEach((point: any, i: number) => {
    const isTip = TIPS.includes(i);
    const r = isTip ? 7.5 : 5;
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, r, 0, 2 * Math.PI);
    ctx.fillStyle = isTip ? '#ffd60a' : '#f6f7fb';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0d0f24';
    ctx.stroke();
  });
  ctx.restore();
}
