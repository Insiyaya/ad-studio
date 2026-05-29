/**
 * Mock AI service implementations.
 *
 * WHY mocks that log API shapes: each mock records what a real API call would
 * look like — endpoint, payload, expected response. When a real key is plugged
 * in and FEATURE_REAL_AI=true, the engineer replacing these mocks knows
 * exactly what the real implementation must produce. Zero surprise handoff.
 *
 * Word-count-to-duration math assumes 140 WPM — standard for professional
 * voiceover narration (not conversational speech).
 */

import { logger } from '../../config/logger';
import type {
  VoiceoverService,
  VoiceOption,
  GenerateVoiceoverOptions,
  GenerateVoiceoverResult,
  ScriptGenerationService,
  GenerateScriptOptions,
  GenerateScriptResult,
  ImageEnhancementService,
  EnhanceImageOptions,
  EnhanceImageResult,
  VideoCompositionService,
  ComposeVideoOptions,
  ComposeVideoResult,
  AdSceneCopy,
  AdTone,
} from './interfaces';

const WORDS_PER_MINUTE = 140;

// Representative voice set mirroring ElevenLabs' V2 library
const MOCK_VOICES: VoiceOption[] = [
  { id: 'mock-aria', name: 'Aria', gender: 'female', accent: 'American', previewUrl: null },
  { id: 'mock-james', name: 'James', gender: 'male', accent: 'British', previewUrl: null },
  { id: 'mock-nova', name: 'Nova', gender: 'neutral', accent: 'American', previewUrl: null },
  { id: 'mock-elena', name: 'Elena', gender: 'female', accent: 'European', previewUrl: null },
  { id: 'mock-marcus', name: 'Marcus', gender: 'male', accent: 'American', previewUrl: null },
];

// ── Voiceover ─────────────────────────────────────────────────────────────

export class MockVoiceoverService implements VoiceoverService {
  async generate(options: GenerateVoiceoverOptions): Promise<GenerateVoiceoverResult> {
    logger.info('[AI/Mock] Would call ElevenLabs text-to-speech', {
      endpoint: 'POST https://api.elevenlabs.io/v1/text-to-speech/:voice_id',
      voice_id: options.voiceId,
      payload: {
        text: options.script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: options.stability,
          similarity_boost: 0.8,
          speed: options.speed,
        },
      },
      expectedResponseType: 'audio/mpeg (binary)',
    });

    // Simulate network latency without blocking the event loop needlessly
    await delay(600);

    const wordCount = countWords(options.script);
    const durationSeconds = Math.round((wordCount / WORDS_PER_MINUTE) * 60);

    return {
      // Real impl would write the binary response to storage and return the URL
      audioUrl: `/storage/mock/voiceover-${options.voiceId}.mp3`,
      durationSeconds,
      voiceId: options.voiceId,
      script: options.script,
    };
  }

  async listVoices(): Promise<VoiceOption[]> {
    logger.debug('[AI/Mock] Would call GET https://api.elevenlabs.io/v1/voices');
    return MOCK_VOICES;
  }
}

// ── Script generation ─────────────────────────────────────────────────────

export class MockScriptGenerationService implements ScriptGenerationService {
  async generate(options: GenerateScriptOptions): Promise<GenerateScriptResult> {
    logger.info('[AI/Mock] Would call OpenAI Chat Completions', {
      endpoint: 'POST https://api.openai.com/v1/chat/completions',
      model: 'gpt-4-turbo-preview',
      system: 'You are a professional copywriter specializing in 30-second TV and digital ads.',
      user: buildScriptPrompt(options),
      max_tokens: 400,
    });

    await delay(400);

    const sceneCopy = buildSceneCopy(options);
    const script    = buildVoiceoverFromScenes(options, sceneCopy);
    const wordCount = countWords(script);

    return {
      script,
      estimatedDurationSeconds: Math.round((wordCount / WORDS_PER_MINUTE) * 60),
      wordCount,
      sceneCopy,
    };
  }
}

// ── Image enhancement ─────────────────────────────────────────────────────

export class MockImageEnhancementService implements ImageEnhancementService {
  async enhance(options: EnhanceImageOptions): Promise<EnhanceImageResult> {
    logger.info('[AI/Mock] Would call fal.ai image enhancement', {
      endpoint: 'POST https://fal.run/fal-ai/clarity-upscaler',
      payload: {
        image_url: options.imageUrl,
        target_width: options.targetWidth,
        target_height: options.targetHeight,
        style: options.style,
      },
    });

    await delay(300);

    // Pass-through in mock — no actual transformation
    return {
      enhancedUrl: options.imageUrl,
      width: options.targetWidth,
      height: options.targetHeight,
    };
  }
}

// ── Video composition ─────────────────────────────────────────────────────

// Per-job composition progress, keyed by projectId
const compositionProgress = new Map<string, number>();

export class MockVideoCompositionService implements VideoCompositionService {
  async compose(options: ComposeVideoOptions): Promise<ComposeVideoResult> {
    logger.info('[AI/Mock] Would call Creatomate render API', {
      endpoint: 'POST https://api.creatomate.com/v1/renders',
      projectId: options.projectId,
      outputFormat: options.exportSettings.format,
      resolution: options.exportSettings.resolution,
      fps: options.exportSettings.fps,
      trackCount: options.timeline.tracks.length,
      durationSeconds: options.timeline.duration,
    });

    // Simulate progressive rendering at ~10 % per 200 ms
    compositionProgress.set(options.projectId, 0);
    for (let pct = 10; pct <= 100; pct += 10) {
      await delay(200);
      compositionProgress.set(options.projectId, pct);
    }
    compositionProgress.delete(options.projectId);

    return {
      videoUrl: `/storage/mock/render-${options.projectId}.mp4`,
      durationSeconds: options.timeline.duration,
      fileSizeBytes: 8_750_000, // representative ~8.5 MB for a 30s 1080p render
      resolution: options.exportSettings.resolution,
    };
  }

  async getProgress(jobId: string): Promise<number> {
    return compositionProgress.get(jobId) ?? 100;
  }
}

// ── Private helpers ────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildScriptPrompt(options: GenerateScriptOptions): string {
  const maxWords = Math.round((options.targetDurationSeconds / 60) * WORDS_PER_MINUTE);
  return (
    `Write a ${options.targetDurationSeconds}-second ${options.tone} ad voiceover script for ` +
    `"${options.businessName}" (${options.sourceUrl}). ` +
    `Description: ${options.description}. ` +
    (options.tagline ? `Tagline: "${options.tagline}". ` : '') +
    (options.keywords.length ? `Keywords: ${options.keywords.join(', ')}. ` : '') +
    `Under ${maxWords} words. Also return JSON with headline/subtitle for scenes: ` +
    `hook, value_prop, differentiators, and cta.`
  );
}

// ── Theme-aware scene copy ─────────────────────────────────────────────────
//
// WHY theme detection over raw description quoting:
// A meta description like "Discover recipes, home ideas, style inspiration..."
// is SEO copy — passive and descriptive. Ad copy must be active, benefit-led,
// and emotionally engaging. We detect the brand theme and apply proven ad copy
// frameworks so each scene feels written for the viewer, not scraped from a page.

type BrandTheme =
  | 'discovery' | 'staffing' | 'commerce' | 'education'
  | 'tech'      | 'health'   | 'food'     | 'finance'
  | 'creative'  | 'general';

interface ThemeTemplates {
  hookSubtitle:  string;
  valueHeadline: string;
  valueSuffix:   string;
  proofSubtitle: string; // uses {name} token
  ctaVerb:       string;
}

const THEME_TEMPLATES: Record<BrandTheme, ThemeTemplates> = {
  discovery: {
    hookSubtitle:  'Where your next great idea begins',
    valueHeadline: 'Save what inspires you — all in one place',
    valueSuffix:   'and so much more',
    proofSubtitle: 'Trusted by hundreds of millions of creators on {name}',
    ctaVerb:       'Start exploring on',
  },
  staffing: {
    hookSubtitle:  'Connecting exceptional talent with great opportunity',
    valueHeadline: 'The right hire changes everything',
    valueSuffix:   'across every industry',
    proofSubtitle: '{name} — where great careers are built',
    ctaVerb:       'Partner with',
  },
  commerce: {
    hookSubtitle:  "Find exactly what you're looking for",
    valueHeadline: 'Premium quality. Delivered to your door.',
    valueSuffix:   'and thousands more',
    proofSubtitle: 'Shop {name} — discover something new every day',
    ctaVerb:       'Shop now at',
  },
  education: {
    hookSubtitle:  'Unlock your potential, one skill at a time',
    valueHeadline: 'Learn from experts. Grow faster.',
    valueSuffix:   'and more',
    proofSubtitle: 'Join thousands of learners at {name}',
    ctaVerb:       'Start learning with',
  },
  tech: {
    hookSubtitle:  'Built for the way modern teams work',
    valueHeadline: 'Powerful tools. Seamless workflows.',
    valueSuffix:   'and more',
    proofSubtitle: '{name} — where productivity meets innovation',
    ctaVerb:       'Get started with',
  },
  health: {
    hookSubtitle:  'Your health. Your future. Your choice.',
    valueHeadline: 'Better care starts with better choices',
    valueSuffix:   'and whole-body wellness',
    proofSubtitle: '{name} — dedicated to your wellbeing',
    ctaVerb:       'Connect with',
  },
  food: {
    hookSubtitle:  'Every meal is a new adventure',
    valueHeadline: 'Fresh flavors. Unforgettable experiences.',
    valueSuffix:   'made with love',
    proofSubtitle: '{name} — where great meals are made',
    ctaVerb:       'Experience',
  },
  finance: {
    hookSubtitle:  'Your financial future starts here',
    valueHeadline: 'Smart money decisions, made simple',
    valueSuffix:   'all in one place',
    proofSubtitle: '{name} — your partner in financial success',
    ctaVerb:       'Start growing with',
  },
  creative: {
    hookSubtitle:  'Where great design comes to life',
    valueHeadline: 'Create without limits',
    valueSuffix:   'all in one studio',
    proofSubtitle: '{name} — for creators who demand the best',
    ctaVerb:       'Create with',
  },
  general: {
    hookSubtitle:  'Excellence, delivered',
    valueHeadline: 'Built for results that matter',
    valueSuffix:   'and more',
    proofSubtitle: '{name} — setting the standard',
    ctaVerb:       'Work with',
  },
};

function detectTheme(description: string, keywords: string[]): BrandTheme {
  const corpus = `${description} ${keywords.join(' ')}`.toLowerCase();

  if (/\b(discover|explore|inspir|idea|pin|save|board|recipe|style|diy|craft)\b/.test(corpus))
    return 'discovery';
  if (/\b(staff|recruit|hire|talent|workforce|placement|candidate|headhunt)\b/.test(corpus))
    return 'staffing';
  if (/\b(shop|buy|order|product|store|price|cart|checkout|retail|ecommerce)\b/.test(corpus))
    return 'commerce';
  if (/\b(learn|course|train|certif|educat|skill|study|tutor|bootcamp)\b/.test(corpus))
    return 'education';
  if (/\b(software|platform|api|developer|saas|cloud|app|tech|code|devops)\b/.test(corpus))
    return 'tech';
  if (/\b(health|care|medical|clinic|wellness|doctor|patient|therapy|nutrition)\b/.test(corpus))
    return 'health';
  if (/\b(food|restaurant|recipe|meal|eat|dining|cuisine|chef|ingredient)\b/.test(corpus))
    return 'food';
  if (/\b(invest|bank|financ|loan|mortgage|wealth|insur|credit|capital|fund)\b/.test(corpus))
    return 'finance';
  if (/\b(design|creative|brand|agency|studio|art|visual|graphic|motion)\b/.test(corpus))
    return 'creative';
  if (/\b(consult|advisory|strategy|solution|service|manage|outsourc|partner)\b/.test(corpus))
    return 'staffing';
  return 'general';
}

/** Personalise the value headline with actual keywords where possible. */
function buildValueHeadline(
  tmpl: ThemeTemplates,
  keywords: string[],
  theme: BrandTheme,
): string {
  if (keywords.length >= 2) {
    if (theme === 'discovery') {
      return `From ${keywords[0]!.toLowerCase()} to ${keywords[1]!.toLowerCase()} — and everything in between`;
    }
    if (theme === 'staffing') {
      return `Experts in ${keywords[0]} and ${keywords[1]}`;
    }
    if (theme === 'commerce') {
      return `Shop ${keywords[0]!.toLowerCase()}, ${keywords[1]!.toLowerCase()}, and more`;
    }
  }
  return tmpl.valueHeadline;
}

function buildSceneCopy(options: GenerateScriptOptions): AdSceneCopy[] {
  const { businessName, description, tagline, keywords, sourceUrl } = options;

  const domain        = extractDomain(sourceUrl);
  const theme         = detectTheme(description, keywords);
  const tmpl          = THEME_TEMPLATES[theme];
  const cleanKeywords = keywords
    .map((k) => capitalise(k.trim()))
    .filter((k) => k.length > 2 && k.length < 36)
    .slice(0, 5);

  // Hook: brand name + punchy theme-based line (never the raw description)
  const hookSubtitle = tagline
    ? smartTruncate(tagline, 76)
    : tmpl.hookSubtitle;

  // Value: compelling benefit statement personalised with keywords
  const valueHeadline = buildValueHeadline(tmpl, cleanKeywords, theme);
  const valueSubtitle = cleanKeywords.length >= 3
    ? `${cleanKeywords.slice(0, 3).join(', ')} ${tmpl.valueSuffix}`
    : cleanKeywords.length === 2
    ? `${cleanKeywords[0]} and ${cleanKeywords[1]}`
    : '';

  // Proof: keyword list (most scannable, highest specificity)
  const proofHeadline = cleanKeywords.length >= 2
    ? cleanKeywords.slice(0, 4).join('  ·  ')
    : tmpl.valueHeadline;

  const proofSubtitle = tmpl.proofSubtitle.replace('{name}', businessName);

  // CTA: action verb from theme + brand name + bare domain
  const ctaHeadline = `${tmpl.ctaVerb} ${businessName}`;
  const ctaSubtitle = domain;

  return [
    { sceneType: 'hook',  headline: businessName,  subtitle: hookSubtitle  },
    { sceneType: 'value', headline: valueHeadline, subtitle: valueSubtitle },
    { sceneType: 'proof', headline: proofHeadline, subtitle: proofSubtitle },
    { sceneType: 'cta',   headline: ctaHeadline,   subtitle: ctaSubtitle   },
  ];
}


// ── Voiceover from scene copy ──────────────────────────────────────────────

function buildVoiceoverFromScenes(
  options: GenerateScriptOptions,
  scenes: AdSceneCopy[],
): string {
  const { businessName, tone } = options;
  const hook  = scenes.find((s) => s.sceneType === 'hook');
  const value = scenes.find((s) => s.sceneType === 'value');
  const proof = scenes.find((s) => s.sceneType === 'proof');
  const cta   = scenes.find((s) => s.sceneType === 'cta');

  const openings: Record<AdTone, string> = {
    professional: `${businessName}.`,
    energetic:    `Meet ${businessName}!`,
    warm:         `At ${businessName},`,
    luxury:       `Introducing ${businessName}.`,
  };

  const opening      = openings[tone] ?? `${businessName}.`;
  const hookLine     = hook?.subtitle
    ? `${hook.subtitle.replace(/\s*[·•]\s*/g, ', ')}.`
    : '';
  const valueLine    = value?.headline && value.headline !== businessName
    ? `${value.headline}.`
    : '';
  const subtitleLine = value?.subtitle ? `${value.subtitle}.` : '';
  const proofLine    = proof?.headline && proof.headline !== value?.headline
    ? proof.headline.includes('·')
      ? `Explore ${proof.headline.replace(/\s*·\s*/g, ', ')}.`
      : `${proof.headline}.`
    : '';
  const ctaLine      = cta ? `${cta.headline}. Visit ${cta.subtitle}.` : '';

  return [opening, hookLine, valueLine, subtitleLine, proofLine, ctaLine]
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── String utilities ───────────────────────────────────────────────────────


function smartTruncate(s: string, maxLen: number): string {
  const clean = s.trim().replace(/[.!?]+$/, '').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.lastIndexOf(' ', maxLen);
  return (cut > maxLen * 0.6 ? clean.slice(0, cut) : clean.slice(0, maxLen)) + '…';
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
