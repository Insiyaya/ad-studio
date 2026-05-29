import type { ExtractedBrandAssets } from './crawl';

export type ProjectStatus = 'draft' | 'generating' | 'ready' | 'exporting';
export type TrackType = 'images' | 'text' | 'voiceover' | 'music' | 'overlay';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type ExportFormat = 'mp4' | 'webm';
export type ExportResolution = '1920x1080' | '1080x1920' | '1080x1080';
export type TransitionType = 'fade' | 'slide' | 'none';
export type FontWeight = 400 | 500 | 600 | 700;
export type TextAlign = 'left' | 'center' | 'right';
export type ObjectFit = 'cover' | 'contain';

export interface Position {
  /** Percentage of canvas width (0–100) */
  x: number;
  /** Percentage of canvas height (0–100) */
  y: number;
}

export interface Size {
  /** Percentage of canvas width */
  width: number;
  /** Percentage of canvas height */
  height: number;
}

// ── Clip data types — discriminated union on `type` ───────────────────────

export interface ImageClipData {
  type: 'image';
  src: string;
  alt: string;
  transition: TransitionType;
  objectFit: ObjectFit;
}

export interface TextClipData {
  type: 'text';
  content: string;
  fontSize: number;
  fontWeight: FontWeight;
  color: string;
  /** Position as percentage of canvas dimensions */
  position: Position;
  align: TextAlign;
  fontFamily: 'heading' | 'body';
}

export interface AudioClipData {
  type: 'audio';
  /** URL to audio file, null until generated */
  src: string | null;
  volume: number; // 0–1
  /** Voiceover script text (present for voiceover clips) */
  script: string | null;
}

export interface OverlayClipData {
  type: 'overlay';
  overlayType: 'qr' | 'cta' | 'logo';
  /** QR: URL to encode; CTA: button text; Logo: image URL */
  content: string;
  position: Position;
  size: Size;
  visible: boolean;
}

export type ClipData = ImageClipData | TextClipData | AudioClipData | OverlayClipData;

export interface Clip {
  id: string;
  startTime: number; // seconds
  duration: number;  // seconds
  data: ClipData;
}

export interface Track {
  id: string;
  type: TrackType;
  label: string;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
}

export interface AdTimeline {
  /** Total ad duration in seconds */
  duration: number;
  tracks: Track[];
}

export interface ExportSettings {
  resolution: ExportResolution;
  aspectRatio: AspectRatio;
  format: ExportFormat;
  fps: 30 | 60;
}

export interface AdProject {
  id: string;
  name: string;
  sourceUrl: string;
  crawlJobId: string;
  brandAssets: ExtractedBrandAssets;
  timeline: AdTimeline;
  voiceoverScript: string | null;
  status: ProjectStatus;
  exportSettings: ExportSettings;
  createdAt: number;
  updatedAt: number;
}
