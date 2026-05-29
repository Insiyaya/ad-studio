/**
 * Live canvas preview - renders the current timeline frame in the editor.
 * Re-uses the same canvas rendering logic as useVideoPlayer, but driven
 * by the editor's playhead position rather than an animation loop.
 */

import React, { useRef, useEffect } from 'react';
import type { AdTimeline, ImageClipData, TextClipData } from '@shared/types';
import styles from './CanvasPreview.module.css';

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src)!);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

interface CanvasPreviewProps {
  timeline: AdTimeline;
  currentTime: number;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({ timeline, currentTime }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Preload images
  useEffect(() => {
    const imageTrack = timeline.tracks.find((t) => t.type === 'images');
    if (!imageTrack) return;
    const srcs = imageTrack.clips
      .map((c) => (c.data.type === 'image' ? (c.data as ImageClipData).src : null))
      .filter((s): s is string => s !== null);
    void Promise.all(srcs.map(loadImage));
  }, [timeline]);

  // Render whenever time or timeline changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    // Background
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, width, height);

    // Image
    const imageTrack = timeline.tracks.find((t) => t.type === 'images');
    if (imageTrack) {
      const clip = imageTrack.clips.find(
        (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration
      );
      if (clip?.data.type === 'image') {
        const data = clip.data as ImageClipData;
        const img = imageCache.get(data.src);
        if (img?.complete && img.naturalWidth > 0) {
          const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);

          // Vignette
          const grad = ctx.createRadialGradient(width/2, height/2, height*0.2, width/2, height/2, height*0.8);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.5)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
        }
      }
    }

    // Text
    const textTrack = timeline.tracks.find((t) => t.type === 'text');
    if (textTrack) {
      for (const clip of textTrack.clips) {
        if (currentTime < clip.startTime || currentTime >= clip.startTime + clip.duration) continue;
        if (clip.data.type !== 'text') continue;
        const data = clip.data as TextClipData;
        ctx.textAlign = data.align;
        ctx.fillStyle = data.color;
        ctx.font = `${data.fontWeight} ${data.fontSize * 0.5}px ${
          data.fontFamily === 'heading' ? 'Plus Jakarta Sans' : 'DM Sans'
        }, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillText(data.content, (data.position.x / 100) * width, (data.position.y / 100) * height);
        ctx.shadowBlur = 0;
      }
    }
  }, [timeline, currentTime]);

  return (
    <div className={styles.wrapper}>
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className={styles.canvas}
        aria-label="Ad preview frame"
      />
      <div className={styles.timeLabel}>
        {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
      </div>
    </div>
  );
};
