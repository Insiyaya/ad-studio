/**
 * AI service interfaces.
 *
 * WHY interfaces before implementations:
 * The mock implementations and real API implementations are interchangeable
 * at runtime via the feature flag FEATURE_REAL_AI. Callers depend only on
 * these interfaces — swapping ElevenLabs for Resemble.ai is a one-line change
 * in the factory (services/ai/index.ts), not a change to any route or job.
 */

import type { AdTimeline, ExportSettings } from '../../types/project';

// ── Voiceover ─────────────────────────────────────────────────────────────

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  accent: string;
  previewUrl: string | null;
}

export interface GenerateVoiceoverOptions {
  script: string;
  voiceId: string;
  /** Speech rate multiplier: 0.5 (slow) – 2.0 (fast). Default 1.0 */
  speed: number;
  /** Voice stability 0–1. Higher = more consistent, less expressive */
  stability: number;
}

export interface GenerateVoiceoverResult {
  /** Absolute URL or file path to the generated audio */
  audioUrl: string;
  durationSeconds: number;
  voiceId: string;
  script: string;
}

export interface VoiceoverService {
  generate(options: GenerateVoiceoverOptions): Promise<GenerateVoiceoverResult>;
  listVoices(): Promise<VoiceOption[]>;
}

// ── Script generation ─────────────────────────────────────────────────────

export type AdTone = 'professional' | 'energetic' | 'warm' | 'luxury';

/**
 * Copy for a single scene in the 30-second ad.
 * The AI generates all four scenes — nothing is hardcoded in the builder.
 */
export interface AdSceneCopy {
  sceneType: 'hook' | 'value' | 'proof' | 'cta';
  /** Large headline text rendered on the canvas — max ~60 chars */
  headline: string;
  /** Supporting subtitle below the headline — max ~80 chars */
  subtitle: string;
}

export interface GenerateScriptOptions {
  businessName: string;
  /** Meta description — the primary brand statement extracted from the page */
  description: string;
  tagline: string | null;
  /** Target duration in seconds — script word count is calibrated to this */
  targetDurationSeconds: number;
  tone: AdTone;
  /** Keywords/topics extracted from the page — used to identify differentiators */
  keywords: string[];
  /** Canonical page URL — used to derive domain for the CTA */
  sourceUrl: string;
  /** Contact info to personalise the CTA where available */
  contactInfo?: { email?: string | null; phone?: string | null };
}

export interface GenerateScriptResult {
  /** Voiceover narration script */
  script: string;
  /** Estimated read-aloud duration at natural pace */
  estimatedDurationSeconds: number;
  wordCount: number;
  /**
   * Structured copy for each of the four ad scenes.
   * The builder uses these directly — it never derives copy from raw brand data.
   */
  sceneCopy: AdSceneCopy[];
}

export interface ScriptGenerationService {
  generate(options: GenerateScriptOptions): Promise<GenerateScriptResult>;
}

// ── Image enhancement ─────────────────────────────────────────────────────

export type EnhancementStyle = 'professional' | 'cinematic' | 'vibrant';

export interface EnhanceImageOptions {
  imageUrl: string;
  targetWidth: number;
  targetHeight: number;
  style: EnhancementStyle;
}

export interface EnhanceImageResult {
  enhancedUrl: string;
  width: number;
  height: number;
}

export interface ImageEnhancementService {
  enhance(options: EnhanceImageOptions): Promise<EnhanceImageResult>;
}

// ── Video composition ─────────────────────────────────────────────────────

export interface ComposeVideoOptions {
  projectId: string;
  timeline: AdTimeline;
  exportSettings: ExportSettings;
}

export interface ComposeVideoResult {
  videoUrl: string;
  durationSeconds: number;
  fileSizeBytes: number;
  resolution: string;
}

export interface VideoCompositionService {
  compose(options: ComposeVideoOptions): Promise<ComposeVideoResult>;
  /** Returns progress percentage 0–100 for a running composition job */
  getProgress(jobId: string): Promise<number>;
}

// ── Aggregated AI services bundle ─────────────────────────────────────────

export interface AiServices {
  voiceover: VoiceoverService;
  scriptGeneration: ScriptGenerationService;
  imageEnhancement: ImageEnhancementService;
  videoComposition: VideoCompositionService;
}
