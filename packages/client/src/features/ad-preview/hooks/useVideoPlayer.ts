/**
 * Canvas-based video player hook.
 *
 * Renders a 30-second ad preview to an HTMLCanvasElement at 60 fps via RAF.
 * Visual techniques used to simulate a professional video ad:
 *  - Ken Burns effect: each image slowly zooms/pans using one of 4 presets
 *  - Cross-dissolve transitions: 0.8s blend between image clips at their boundary
 *  - Text fade + slide-up: text blocks animate in from below, fade out cleanly
 *  - Multi-line word-wrap: no text overflow, always readable
 *  - Cinematic gradients: strong bottom gradient + softer top gradient
 *  - Overlay rendering: logo badge top-left, CTA pill button bottom-center
 *  - Brand accent bar: 4px brand-primary line at the very bottom
 *
 * WHY canvas over <video>: the ad is assembled from crawled images - there is
 * no video file. Real FFmpeg rendering would replace this with a <video> element
 * backed by a rendered URL when FEATURE_FFMPEG_EXPORT=true.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type { AdTimeline, ImageClipData, TextClipData, OverlayClipData, Clip } from '@shared/types';

// ── Options & result types ─────────────────────────────────────────────────

export interface BrandData {
  /** Primary brand colour - used for accent bar, CTA button, text highlights. */
  primaryColor: string;
  /** URL of the brand logo. Rendered as a watermark top-left. */
  logoUrl: string | null;
}

interface UseVideoPlayerOptions {
  timeline: AdTimeline;
  brand?: BrandData;
}

interface UseVideoPlayerResult {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  playing: boolean;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  toggleFullscreen: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TRANSITION_DURATION = 0.8;  // seconds, cross-dissolve overlap
const TEXT_FADE_IN        = 0.45; // seconds
const TEXT_FADE_OUT       = 0.40; // seconds
const TEXT_SLIDE_PX       = 18;   // pixels to slide from on entrance
const DEFAULT_ACCENT      = '#FF2D3C';

// ── Ken Burns presets ──────────────────────────────────────────────────────
// Each preset defines start/end scale and focal point (0–1, where 0.5/0.5 is
// centre). Applied cyclically by image index for visual variety.

interface KBPreset {
  sFrom: number; sTo: number;
  fxFrom: number; fyFrom: number;
  fxTo: number;  fyTo: number;
}

const KB_PRESETS: KBPreset[] = [
  { sFrom: 1.00, sTo: 1.07, fxFrom: 0.5, fyFrom: 0.5, fxTo: 0.5, fyTo: 0.42 }, // zoom in, drift up
  { sFrom: 1.07, sTo: 1.00, fxFrom: 0.4, fyFrom: 0.4, fxTo: 0.6, fyTo: 0.58 }, // zoom out, drift right-down
  { sFrom: 1.00, sTo: 1.06, fxFrom: 0.65, fyFrom: 0.5, fxTo: 0.38, fyTo: 0.5 }, // zoom in, drift left
  { sFrom: 1.06, sTo: 1.00, fxFrom: 0.5, fyFrom: 0.62, fxTo: 0.5, fyTo: 0.40 }, // zoom out, drift up
];

// ── Image cache (global - persists across re-renders) ──────────────────────

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(src);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = () => resolve(img); // blank frame on error - never reject
    img.src = src;
  });
}

// ── Pure drawing helpers ───────────────────────────────────────────────────

function drawKenBurns(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  clipIndex: number,
  progress: number, // 0–1 within the clip
  alpha: number,
  w: number,
  h: number,
): void {
  if (!img.complete || img.naturalWidth === 0) return;

  const p  = Math.max(0, Math.min(1, progress));
  const kb = KB_PRESETS[clipIndex % KB_PRESETS.length] as KBPreset;

  const scale  = kb.sFrom + (kb.sTo - kb.sFrom) * p;
  const focusX = kb.fxFrom + (kb.fxTo - kb.fxFrom) * p;
  const focusY = kb.fyFrom + (kb.fyTo - kb.fyFrom) * p;

  const base  = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const final = base * scale;
  const drawW = img.naturalWidth  * final;
  const drawH = img.naturalHeight * final;

  // Clamp focal point so the image never reveals a gap
  const maxOX = Math.max(0, drawW - w);
  const maxOY = Math.max(0, drawH - h);
  const dx = -(focusX * maxOX);
  const dy = -(focusY * maxOY);

  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.globalAlpha = 1;
}

function drawGradients(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Bottom - strong, for text legibility
  const bot = ctx.createLinearGradient(0, h * 0.30, 0, h);
  bot.addColorStop(0,    'rgba(0,0,0,0)');
  bot.addColorStop(0.55, 'rgba(0,0,0,0.52)');
  bot.addColorStop(1,    'rgba(0,0,0,0.82)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, 0, w, h);

  // Top - lighter, just enough for logo badge legibility
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.28);
  top.addColorStop(0, 'rgba(0,0,0,0.55)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h);
}

/** Eased 0–1 alpha for a clip's entrance / exit. */
function clipAlpha(clip: Clip, time: number): number {
  const elapsed   = time - clip.startTime;
  const remaining = clip.duration - elapsed;
  if (elapsed   < TEXT_FADE_IN)  return elapsed   / TEXT_FADE_IN;
  if (remaining < TEXT_FADE_OUT) return remaining / TEXT_FADE_OUT;
  return 1;
}

/** Slide-up offset in px - only during fade-in. */
function clipSlide(clip: Clip, time: number): number {
  const elapsed = time - clip.startTime;
  if (elapsed >= TEXT_FADE_IN) return 0;
  return (1 - elapsed / TEXT_FADE_IN) * TEXT_SLIDE_PX;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function renderTextClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  time: number,
  w: number,
  h: number,
): void {
  if (clip.data.type !== 'text') return;
  const d = clip.data as TextClipData;

  const alpha   = clipAlpha(clip, time);
  const slideY  = clipSlide(clip, time);
  const baseX   = (d.position.x / 100) * w;
  const baseY   = (d.position.y / 100) * h + slideY;
  const maxW    = w * 0.80;
  const family  = d.fontFamily === 'heading' ? 'Plus Jakarta Sans' : 'DM Sans';

  ctx.font = `${d.fontWeight} ${d.fontSize}px "${family}", sans-serif`;
  ctx.textAlign    = d.align;
  ctx.textBaseline = 'middle';

  const lines      = wrapText(ctx, d.content, maxW);
  const lineHeight = d.fontSize * 1.28;
  const totalH     = lines.length * lineHeight;
  const firstY     = baseY - totalH / 2 + lineHeight / 2;

  ctx.globalAlpha    = alpha;
  ctx.shadowColor    = 'rgba(0,0,0,0.90)';
  ctx.shadowBlur     = 18;
  ctx.shadowOffsetY  = 2;
  ctx.fillStyle      = d.color;

  lines.forEach((ln, i) => {
    ctx.fillText(ln, baseX, firstY + i * lineHeight);
  });

  ctx.shadowBlur    = 0;
  ctx.shadowOffsetY = 0;
  ctx.globalAlpha   = 1;
  ctx.textBaseline  = 'alphabetic';
}

function renderOverlayClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  time: number,
  w: number,
  h: number,
  accentColor: string,
): void {
  if (clip.data.type !== 'overlay') return;
  const d = clip.data as OverlayClipData;
  if (!d.visible) return;

  // Quick 0.3s fade-in on appearance
  const elapsed = time - clip.startTime;
  const alpha   = Math.min(1, elapsed / 0.3);

  if (d.overlayType === 'logo') {
    const logoImg = imageCache.get(d.content);
    if (!logoImg || !logoImg.complete || logoImg.naturalWidth === 0) return;

    const maxW  = w * 0.13;
    const maxH  = h * 0.09;
    const scale = Math.min(maxW / logoImg.naturalWidth, maxH / logoImg.naturalHeight);
    const lw    = logoImg.naturalWidth  * scale;
    const lh    = logoImg.naturalHeight * scale;
    const lx    = w * 0.038;
    const ly    = h * 0.048;
    const pad   = 8;

    // Frosted backdrop
    ctx.globalAlpha = alpha * 0.45;
    ctx.fillStyle   = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    // roundRect may not exist in all environments - use manual arc fallback
    const rx = lx - pad, ry = ly - pad, rw = lw + pad * 2, rh = lh + pad * 2, r = 7;
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + rw - r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + r, r);
    ctx.lineTo(rx + rw, ry + rh - r);
    ctx.arcTo(rx + rw, ry + rh, rx + rw - r, ry + rh, r);
    ctx.lineTo(rx + r, ry + rh);
    ctx.arcTo(rx, ry + rh, rx, ry + rh - r, r);
    ctx.lineTo(rx, ry + r);
    ctx.arcTo(rx, ry, rx + r, ry, r);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = alpha * 0.95;
    ctx.drawImage(logoImg, lx, ly, lw, lh);
    ctx.globalAlpha = 1;

  } else if (d.overlayType === 'cta') {
    // Pill button with brand accent background
    const btnW = w * 0.30;
    const btnH = h * 0.075;
    const btnX = w / 2 - btnW / 2;
    const btnY = h * 0.815;

    let domain = d.content;
    try { domain = new URL(d.content).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }

    const fontSize = Math.round(btnH * 0.36);

    ctx.globalAlpha = alpha;

    // Drop shadow under button
    ctx.shadowColor   = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur    = 14;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle     = accentColor;
    const r = btnH / 2;
    ctx.beginPath();
    ctx.moveTo(btnX + r, btnY);
    ctx.lineTo(btnX + btnW - r, btnY);
    ctx.arcTo(btnX + btnW, btnY, btnX + btnW, btnY + r, r);
    ctx.lineTo(btnX + btnW, btnY + btnH - r);
    ctx.arcTo(btnX + btnW, btnY + btnH, btnX + btnW - r, btnY + btnH, r);
    ctx.lineTo(btnX + r, btnY + btnH);
    ctx.arcTo(btnX, btnY + btnH, btnX, btnY + btnH - r, r);
    ctx.lineTo(btnX, btnY + r);
    ctx.arcTo(btnX, btnY, btnX + r, btnY, r);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle    = '#FFFFFF';
    ctx.font         = `600 ${fontSize}px "DM Sans", sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(domain, w / 2, btnY + btnH / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign    = 'left';

    ctx.globalAlpha = 1;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useVideoPlayer({ timeline, brand }: UseVideoPlayerOptions): UseVideoPlayerResult {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const rafRef        = useRef<number | null>(null);
  const lastTimeRef   = useRef<number | null>(null);
  const currentTimeRef = useRef(0);

  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const duration    = timeline.duration;
  const accentColor = brand?.primaryColor ?? DEFAULT_ACCENT;

  // Preload all media on mount / timeline change
  useEffect(() => {
    const srcs: string[] = [];

    for (const track of timeline.tracks) {
      for (const clip of track.clips) {
        if (clip.data.type === 'image'   && (clip.data as ImageClipData).src)     srcs.push((clip.data as ImageClipData).src);
        if (clip.data.type === 'overlay' && (clip.data as OverlayClipData).content) srcs.push((clip.data as OverlayClipData).content);
      }
    }
    if (brand?.logoUrl) srcs.push(brand.logoUrl);

    void Promise.all([...new Set(srcs)].map(loadImage));
  }, [timeline, brand]);

  // ── Core frame renderer ──────────────────────────────────────────────────
  const renderFrame = useCallback(
    (time: number): void => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { width: w, height: h } = canvas;

      // 1. Background
      ctx.fillStyle = '#0A0A0F';
      ctx.fillRect(0, 0, w, h);

      // 2. Image track - Ken Burns + cross-dissolve
      const imageTrack = timeline.tracks.find((t) => t.type === 'images');
      if (imageTrack) {
        const imgClips = imageTrack.clips.filter((c) => c.data.type === 'image');
        const activeIdx = imgClips.findIndex(
          (c) => time >= c.startTime && time < c.startTime + c.duration,
        );

        if (activeIdx >= 0) {
          const active  = imgClips[activeIdx] as Clip;
          const next    = imgClips[activeIdx + 1] as Clip | undefined;
          const progress = (time - active.startTime) / active.duration;

          let mainAlpha  = 1.0;
          let blendAlpha = 0.0;

          if (next) {
            const tStart = active.startTime + active.duration - TRANSITION_DURATION;
            if (time >= tStart) {
              blendAlpha = Math.min(1, (time - tStart) / TRANSITION_DURATION);
              mainAlpha  = 1 - blendAlpha;
            }
          }

          const activeImg = imageCache.get((active.data as ImageClipData).src);
          if (activeImg) drawKenBurns(ctx, activeImg, activeIdx, progress, mainAlpha, w, h);

          if (blendAlpha > 0 && next) {
            const nextProgress = Math.max(0, (time - next.startTime) / next.duration);
            const nextImg = imageCache.get((next.data as ImageClipData).src);
            if (nextImg) drawKenBurns(ctx, nextImg, activeIdx + 1, nextProgress, blendAlpha, w, h);
          }
        }
      }

      // 3. Cinematic gradients
      drawGradients(ctx, w, h);

      // 4. Text track - animated
      const textTrack = timeline.tracks.find((t) => t.type === 'text');
      if (textTrack) {
        for (const clip of textTrack.clips) {
          if (time >= clip.startTime && time < clip.startTime + clip.duration) {
            renderTextClip(ctx, clip, time, w, h);
          }
        }
      }

      // 5. Overlay track (logo + CTA)
      const overlayTrack = timeline.tracks.find((t) => t.type === 'overlay');
      if (overlayTrack) {
        for (const clip of overlayTrack.clips) {
          if (time >= clip.startTime && time < clip.startTime + clip.duration) {
            renderOverlayClip(ctx, clip, time, w, h, accentColor);
          }
        }
      }

      // 6. Brand accent bar + progress
      const progressW = (time / duration) * w;
      ctx.fillStyle   = 'rgba(255,255,255,0.10)';
      ctx.fillRect(0, h - 4, w, 4);
      ctx.fillStyle   = accentColor;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(0, h - 4, progressW, 4);
      ctx.globalAlpha = 1;
    },
    [timeline, duration, accentColor],
  );

  // ── RAF loop ─────────────────────────────────────────────────────────────
  const tick = useCallback(
    (timestamp: number): void => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const next = Math.min(currentTimeRef.current + delta, duration);
      currentTimeRef.current = next;
      setCurrentTime(next);
      renderFrame(next);

      if (next < duration) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
        lastTimeRef.current = null;
      }
    },
    [duration, renderFrame],
  );

  // Initial render on mount
  useEffect(() => {
    // Small delay to let images start loading before the first paint
    const id = setTimeout(() => renderFrame(0), 80);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render when timeline/brand changes while paused
  useEffect(() => {
    if (!playing) renderFrame(currentTimeRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline, brand]);

  const play = useCallback((): void => {
    if (currentTimeRef.current >= duration) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }
    setPlaying(true);
    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, duration]);

  const pause = useCallback((): void => {
    setPlaying(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimeRef.current = null;
  }, []);

  const seek = useCallback(
    (time: number): void => {
      const clamped = Math.max(0, Math.min(time, duration));
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      renderFrame(clamped);
    },
    [duration, renderFrame],
  );

  const toggleFullscreen = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!document.fullscreenElement) void canvas.requestFullscreen();
    else void document.exitFullscreen();
  }, []);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { canvasRef, playing, currentTime, duration, play, pause, seek, toggleFullscreen };
}
