/**
 * Image quality filtering and scoring.
 *
 * WHY filter images at all: a typical marketing page has 50–200 <img> elements,
 * many of which are tracking pixels, icons, spacers, or tiny thumbnails.
 * We want only the top content images — the ones that could actually appear
 * in a 30-second video ad.
 *
 * Scoring factors:
 * - Size: larger images score higher
 * - Aspect ratio: extreme ratios (banners, strips) score lower
 * - DOM position: images inside <main>, <article>, <section> score higher
 * - URL signals: 'hero', 'banner', 'product' in the URL score higher
 * - Alt text present: slight quality signal
 */

import type { ExtractedImage } from '../../types/crawl';

const MIN_NATURAL_WIDTH = 200;
const MIN_NATURAL_HEIGHT = 100;
const MAX_ASPECT_RATIO = 6; // skip ultra-wide banners or tall strips

/** URL substrings that reliably indicate non-content images */
const NOISE_URL_PATTERNS = [
  /[?&]w=1(&|$)/, /[?&]h=1(&|$)/, // tracking pixel query params
  /\/pixel\//i, /\/beacon\//i, /\/tracking\//i,
  /\/spacer\./i, /\/blank\./i, /\/transparent\./i,
  /captcha/i, /recaptcha/i,
  /\.svg$/i, // SVG icons — not suitable for video frames
  /\/ads\//i, /\/advertisement/i,
];

/**
 * Third-party user-content CDN hostnames.
 *
 * These domains host user-generated content (pins, posts, tweets) rather than
 * brand assets. When crawling a business page, images from these hosts are
 * almost always irrelevant to the brand being advertised — e.g. Pinterest pins
 * appearing on a staffing company's site, or embedded social feeds.
 */
const USER_CONTENT_CDN_HOSTNAMES = new Set([
  'pinimg.com',        // Pinterest user content
  'i.pinimg.com',
  'fbcdn.net',         // Facebook user content
  'scontent.fbcdn.net',
  'instagram.com',
  'cdninstagram.com',
  'twimg.com',         // Twitter / X user content
  'pbs.twimg.com',
  'abs.twimg.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'snapchat.com',
  'snapchatcdn.com',
  'reddit.com',        // Reddit user content
  'redd.it',
  'redditmedia.com',
  'reddituploads.com',
  'gravatar.com',      // Profile pictures — not brand content
  'unavatar.io',
  'wp.com',            // WordPress.com (multi-tenant, not the crawled brand)
  'placeholder.com',
  'via.placeholder.com',
  'placehold.it',
  'picsum.photos',
  'loremipsum.io',
]);

function isUserContentImage(src: string): boolean {
  try {
    const host = new URL(src).hostname.toLowerCase();
    // Check exact match and suffix match (e.g. "i.pinimg.com" ends with "pinimg.com")
    return [...USER_CONTENT_CDN_HOSTNAMES].some(
      (cdn) => host === cdn || host.endsWith(`.${cdn}`)
    );
  } catch {
    return false;
  }
}

/** URL substrings that suggest high-value content images */
const BOOST_URL_PATTERNS = [
  /hero/i, /banner/i, /feature/i, /showcase/i,
  /product/i, /team/i, /about/i, /office/i,
  /background/i, /cover/i, /main/i, /campaign/i,
];

export interface RawImageCandidate {
  src: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
  /** Tag name of the closest semantic ancestor */
  semanticContext: string;
  /** Whether the image is inside <header>, <nav>, or <footer> */
  isChrome: boolean;
  /** Whether the image is inside <main>, <article>, or <section> */
  isContent: boolean;
}

function isNoisyUrl(src: string): boolean {
  return NOISE_URL_PATTERNS.some((pattern) => pattern.test(src));
}

/**
 * Computes a 0–1 quality score for a raw image candidate.
 * Higher = better candidate for appearing in an ad.
 */
export function scoreImage(candidate: RawImageCandidate): number {
  const { naturalWidth: w, naturalHeight: h, src, alt, isChrome, isContent } = candidate;

  // Hard rejects
  if (w < MIN_NATURAL_WIDTH || h < MIN_NATURAL_HEIGHT) return 0;
  const ratio = Math.max(w, h) / Math.min(w, h);
  if (ratio > MAX_ASPECT_RATIO) return 0;
  if (isNoisyUrl(src)) return 0;
  if (isUserContentImage(src)) return 0; // Pinterest pins, FB/Twitter posts etc.
  if (isChrome) return 0; // nav/header/footer images are UI chrome, not content

  let score = 0;

  // Size contribution (normalised against 1920×1080)
  const area = w * h;
  const targetArea = 1920 * 1080;
  score += Math.min(area / targetArea, 1) * 0.40;

  // Aspect ratio contribution — 16:9 and 4:3 are ideal for video
  const aspectScore = 1 - Math.min(Math.abs(ratio - 1.78), Math.abs(ratio - 1.33)) / 3;
  score += Math.max(aspectScore, 0) * 0.25;

  // Semantic context bonus
  if (isContent) score += 0.15;

  // URL signal boost
  if (BOOST_URL_PATTERNS.some((p) => p.test(src))) score += 0.10;

  // Alt text present
  if (alt && alt.trim().length > 0) score += 0.05;

  // Small resolution bonus cap to keep things from going over 1
  // Large images that are landscape get a slight final boost
  if (w >= 800 && h >= 450) score += 0.05;

  return Math.min(score, 1);
}

/**
 * Determines whether an image is likely the site logo based on:
 * - Positioned inside <header>
 * - Small-to-medium dimensions with a wide aspect ratio
 * - URL or alt text containing "logo"
 */
export function isLikelyLogo(candidate: RawImageCandidate): boolean {
  const urlHint = /logo/i.test(candidate.src) || /logo/i.test(candidate.alt);
  const sizeHint =
    candidate.naturalWidth >= 50 &&
    candidate.naturalWidth <= 400 &&
    candidate.naturalHeight <= 150;
  const contextHint = candidate.semanticContext === 'header' || candidate.isChrome;

  return urlHint || (sizeHint && contextHint);
}

/**
 * Filters and ranks a list of raw image candidates.
 * Returns only images with score > 0, sorted best-first, capped at maxCount.
 *
 * @param sourceUrl  The crawled page URL — images on the same domain score higher.
 */
export function filterAndRankImages(
  candidates: RawImageCandidate[],
  maxCount = 12,
  sourceUrl?: string,
): ExtractedImage[] {
  let sourceHost = '';
  if (sourceUrl) {
    try { sourceHost = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, ''); }
    catch { /* ignore */ }
  }

  return candidates
    .map((c) => {
      let score = scoreImage(c);
      if (score > 0 && sourceHost) {
        // Boost images served from the same domain (brand-owned assets)
        try {
          const imgHost = new URL(c.src).hostname.toLowerCase().replace(/^www\./, '');
          if (imgHost === sourceHost || imgHost.endsWith(`.${sourceHost}`)) {
            score = Math.min(score + 0.18, 1);
          }
        } catch { /* ignore */ }
      }
      return {
        src: c.src, alt: c.alt,
        naturalWidth: c.naturalWidth, naturalHeight: c.naturalHeight,
        qualityScore: score,
        isLikelyLogo: isLikelyLogo(c),
      };
    })
    .filter((img) => img.qualityScore > 0)
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, maxCount);
}
