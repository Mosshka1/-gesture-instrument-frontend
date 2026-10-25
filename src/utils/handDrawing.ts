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
  ctx.shadowColor = '#3de8c8';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = '#3de8c8';
  ctx.lineWidth = 3;
  HAND_CONNECTIONS.forEach(([start, end]) => {
    const p1 = landmarks[start];
    const p2 = landmarks[end];
    ctx.beginPath();
    ctx.moveTo(p1.x * width, p1.y * height);
    ctx.lineTo(p2.x * width, p2.y * height);
    ctx.stroke();
  });

  landmarks.forEach((point: any, i: number) => {
    const isTip = TIPS.includes(i);
    ctx.shadowColor = isTip ? '#c6f23a' : '#ffffff';
    ctx.fillStyle = isTip ? '#c6f23a' : '#ffffff';
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, isTip ? 6 : 4, 0, 2 * Math.PI);
    ctx.fill();
  });
  ctx.restore();
}
