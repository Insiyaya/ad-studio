/**
 * Client-side domain types - mirror the server's type definitions.
 *
 * WHY duplicated rather than shared via a workspace package:
 * Sharing types across packages would require a build step or complex TS
 * project references configuration. For a prototype, co-locating the types
 * and keeping them in sync manually is simpler. In production, extract to
 * a dedicated `@ad-studio/types` workspace package.
 */

// ── Crawl ─────────────────────────────────────────────────────────────────

export type CrawlStatus =
  | 'queued'
  | 'connecting'
  | 'extracting_assets'
  | 'analyzing_brand'
  | 'generating_concept'
  | 'complete'
  | 'failed';

export type CrawlStepStatus = 'pending' | 'processing' | 'complete' | 'error';

export interface CrawlStep {
  status: CrawlStepStatus;
  label: string;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
}

export interface CrawlSteps {
  connecting: CrawlStep;
  extracting_assets: CrawlStep;
  analyzing_brand: CrawlStep;
  generating_concept: CrawlStep;
}

export interface ExtractedImage {
  src: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
  qualityScore: number;
  isLikelyLogo: boolean;
}

export interface BrandColors {
  primary: string | null;
  secondary: string | null;
  background: string | null;
  text: string | null;
  all: string[];
}

export interface ContactInfo {
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface ExtractedBrandAssets {
  sourceUrl: string;
  pageTitle: string;
  metaDescription: string;
  businessName: string;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  images: ExtractedImage[];
  colors: BrandColors;
  contactInfo: ContactInfo;
  ogImage: string | null;
  keywords: string[];
}

export interface CrawlJob {
  id: string;
  url: string;
  status: CrawlStatus;
  steps: CrawlSteps;
  result: ExtractedBrandAssets | null;
  projectId: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

// ── Project ───────────────────────────────────────────────────────────────

export type ProjectStatus = 'draft' | 'generating' | 'ready' | 'exporting';
export type TrackType = 'images' | 'text' | 'voiceover' | 'music' | 'overlay';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type ExportFormat = 'mp4' | 'webm';
export type ExportResolution = '1920x1080' | '1080x1920' | '1080x1080';
export type TransitionType = 'fade' | 'slide' | 'none';
export type FontWeight = 400 | 500 | 600 | 700;
export type TextAlign = 'left' | 'center' | 'right';
export type ObjectFit = 'cover' | 'contain';

export interface Position { x: number; y: number }
export interface Size { width: number; height: number }

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
  position: Position;
  align: TextAlign;
  fontFamily: 'heading' | 'body';
}

export interface AudioClipData {
  type: 'audio';
  src: string | null;
  volume: number;
  script: string | null;
}

export interface OverlayClipData {
  type: 'overlay';
  overlayType: 'qr' | 'cta' | 'logo';
  content: string;
  position: Position;
  size: Size;
  visible: boolean;
}

export type ClipData = ImageClipData | TextClipData | AudioClipData | OverlayClipData;

export interface Clip {
  id: string;
  startTime: number;
  duration: number;
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

// ── API shapes ────────────────────────────────────────────────────────────

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface CreateCrawlResponseBody {
  jobId: string;
  status: CrawlStatus;
  message: string;
}

export interface CrawlStatusResponseBody {
  job: CrawlJob;
}

export interface GetProjectResponseBody {
  project: AdProject;
}

export interface UpdateProjectResponseBody {
  project: AdProject;
}

export interface UpdateProjectRequestBody {
  name?: string;
  timeline?: AdTimeline;
  voiceoverScript?: string | null;
  exportSettings?: Partial<ExportSettings>;
}

// ── WebSocket ─────────────────────────────────────────────────────────────

export type WsServerMessageType =
  | 'subscribed'
  | 'unsubscribed'
  | 'job_update'
  | 'job_complete'
  | 'job_error'
  | 'pong'
  | 'error';

export interface WsServerMessage {
  type: WsServerMessageType;
  jobId?: string;
  data?: CrawlJob | { message: string };
  timestamp: number;
}
