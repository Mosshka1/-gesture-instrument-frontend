import { useEffect, useRef, useState } from 'react';
import { drawHandSkeleton } from '../utils/handDrawing';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
    google: any;
  }
}

export type CameraStatus = 'starting' | 'ready' | 'error';

type FrameCallback = (handsFound: any[][], ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void;

export function useHandTracking(onFrame: FrameCallback, confidence = 60) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const handsRef = useRef<any>(null);
  const confidenceRef = useRef(confidence);
  confidenceRef.current = confidence;

  const [status, setStatus] = useState<CameraStatus>('starting');
  const [fps, setFps] = useState(0);
  const [aspect, setAspect] = useState(4 / 3);

  // Поріг упевненості можна міняти "на льоту"
  useEffect(() => {
    const c = Math.min(0.95, Math.max(0.2, confidence / 100));
    handsRef.current?.setOptions({ minDetectionConfidence: c, minTrackingConfidence: Math.max(0.2, c - 0.1) });
  }, [confidence]);

  useEffect(() => {
    let cameraInstance: any = null;
    let isActive = true;
    let frames = 0;
    let lastFpsTime = performance.now();

    if (!window.Hands || !window.Camera) {
      setStatus('error');
      return;
    }

    const hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    handsRef.current = hands;

    const c0 = Math.min(0.95, Math.max(0.2, confidenceRef.current / 100));
    hands.setOptions({
      maxNumHands: 2,
      // на телефонах використовуємо легшу модель — вищий FPS і менше нагрівання
      modelComplexity: /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) ? 0 : 1,
      minDetectionConfidence: c0,
      minTrackingConfidence: Math.max(0.2, c0 - 0.1),
    });

    hands.onResults((results: any) => {
      if (!isActive) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // підлаштовуємо полотно під реальні пропорції відео (на телефоні кадр може бути вертикальним)
      const video = videoRef.current;
      if (video && video.videoWidth && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        setAspect(video.videoWidth / video.videoHeight);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const handsFound: any[][] = results.multiHandLandmarks || [];
      handsFound.forEach((landmarks) => {
        drawHandSkeleton(ctx, landmarks, canvas.width, canvas.height);
      });

      onFrameRef.current(handsFound, ctx, canvas);

      frames++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        setFps(Math.round((frames * 1000) / (now - lastFpsTime)));
        frames = 0;
        lastFpsTime = now;
        setStatus('ready');
      }
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
      Promise.resolve(cameraInstance.start()).catch(() => {
        if (isActive) setStatus('error');
      });
    }

    return () => {
      isActive = false;
      handsRef.current = null;
      cameraInstance?.stop();
      hands.close?.();
    };
  }, []);

  return { videoRef, canvasRef, status, fps, aspect };
}
