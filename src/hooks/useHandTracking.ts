import { useEffect, useRef } from 'react';
import { drawHandSkeleton } from '../utils/handDrawing';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

export function useHandTracking(onLandmarks: (handsFound: any[][]) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onLandmarksRef = useRef(onLandmarks);
  onLandmarksRef.current = onLandmarks;

  useEffect(() => {
    let cameraInstance: any = null;
    let isActive = true;
    let handsInstance: any = null;

    const hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    handsInstance = hands;

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results: any) => {
      if (!isActive) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const handsFound = results.multiHandLandmarks || [];
      handsFound.forEach((landmarks: any[]) => {
        drawHandSkeleton(ctx, landmarks, canvas.width, canvas.height);
      });

      onLandmarksRef.current(handsFound);
    });

    if (videoRef.current) {
      cameraInstance = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && isActive) {
            await hands.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
      cameraInstance.start();
    }

    return () => {
      isActive = false;
      cameraInstance?.stop();
      handsInstance?.close?.();
    };
  }, []);

  return { videoRef, canvasRef };
}