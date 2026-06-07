/**
 * Crawler service - axios + cheerio implementation.
 *
 * WHY replaced Puppeteer: Render's free Node tier has no Chromium binary.
 * For the prototype, static HTML extraction via axios+cheerio covers all
 * the brand data we need (meta tags, OG, images, theme-color).
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../config/logger';
import { filterAndRankImages, type RawImageCandidate } from './assetFilter';
import type { ExtractedBrandAssets, ContactInfo, BrandColors } from '../../types/crawl';

// no-op — kept so the import in index.ts compiles without changes
export async function closeBrowser(): Promise<void> {}

// ── Contact info ──────────────────────────────────────────────────────────

function extractContactInfo(bodyText: string): ContactInfo {
  const emailMatch = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/.exec(bodyText);
  const phoneMatch =
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{1,3}[-.\s]\d{2,4}[-.\s]\d{4,8})/.exec(
      bodyText
    );
  return {
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[0] ?? null,
    address: null,
  };
}

// ── Business name ─────────────────────────────────────────────────────────

function inferBusinessName(ogSiteName: string | null, pageTitle: string, url: string): string {
  if (ogSiteName) return ogSiteName;
  const sep = /^(.+?)\s*[\|–—\-]\s*(.+)$/.exec(pageTitle);
  if (sep) {
    const [, a, b] = sep;
    return (a!.length <= b!.length ? a : b) ?? pageTitle;
  }
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const domain = hostname.split('.')[0] ?? hostname;
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return pageTitle;
  }
}

// ── Color extraction from static HTML ────────────────────────────────────

function brandScore(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = r * 0.299 + g * 0.587 + b * 0.114;
  return saturation * 0.7 - Math.abs(brightness - 0.45) * 0.45;
}

function normaliseColor(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^#[0-9a-f]{3}$/.test(t))
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(t);
  if (m) {
    const r = parseInt(m[1]!, 10);
    const g = parseInt(m[2]!, 10);
    const b = parseInt(m[3]!, 10);
    const br = (r * 299 + g * 587 + b * 114) / 1000;
    if (br > 235 || br < 20) return null;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return null;
}

function extractColors($: cheerio.CheerioAPI): BrandColors {
  const candidates: string[] = [];

  // 1. Meta theme-color
  const themeColor = $('meta[name="theme-color"]').attr('content');
  if (themeColor) candidates.push(themeColor);

  // 2. Inline style background-color on structural elements
  const selectors = ['header', 'nav', '[class*="hero"]', '[class*="banner"]', 'footer', 'button'];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const style = $(el).attr('style') ?? '';
      const bg = /background(?:-color)?\s*:\s*([^;]+)/.exec(style);
      const fg = /(?<!\w)color\s*:\s*([^;]+)/.exec(style);
      if (bg) candidates.push(bg[1]!.trim());
      if (fg) candidates.push(fg[1]!.trim());
    });
  }

  const ranked = [...new Set(candidates.map(normaliseColor).filter((c): c is string => c !== null))]
    .sort((a, b) => brandScore(b) - brandScore(a))
    .slice(0, 8);

  return {
    primary: ranked[0] ?? null,
    secondary: ranked[1] ?? null,
    background: ranked[2] ?? null,
    text: ranked[3] ?? null,
    all: ranked,
  };
}

// ── Public API ────────────────────────────────────────────────────────────

export interface CrawlProgressCallback {
  (step: 'connecting' | 'extracting_assets' | 'analyzing_brand' | 'generating_concept'): void;
}

export async function crawlUrl(
  url: string,
  onStep: CrawlProgressCallback
): Promise<ExtractedBrandAssets> {
  onStep('connecting');
  logger.info('Starting crawl (axios+cheerio)', { url });

  const { data: html } = await axios.get<string>(url, {
    timeout: 20_000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AdStudioBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    maxRedirects: 5,
  });

  onStep('extracting_assets');
  const $ = cheerio.load(html);

  const pageTitle = $('title').first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ??
    $('meta[property="og:description"]').attr('content')?.trim() ??
    '';
  const ogSiteName = $('meta[property="og:site_name"]').attr('content')?.trim() ?? null;
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() ?? null;

  const heroH1 = $('header h1, [class*="hero"] h1, [class*="banner"] h1, main h1').first().text().trim();
  const tagline = heroH1 || $('meta[name="slogan"]').attr('content')?.trim() || null;

  const keywords = ($('meta[name="keywords"]').attr('content') ?? '')
    .split(',').map(k => k.trim()).filter(Boolean).slice(0, 10);

  // Favicon
  const faviconHref =
    $('link[rel="icon"]').attr('href') ??
    $('link[rel="shortcut icon"]').attr('href') ??
    $('link[rel="apple-touch-icon"]').attr('href') ??
    '/favicon.ico';
  const faviconUrl = faviconHref
    ? new URL(faviconHref, url).href
    : null;

  // Images
  const rawImageCandidates: RawImageCandidate[] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') ?? $(el).attr('data-src') ?? '';
    if (!src) return;
    let resolvedSrc = src;
    try { resolvedSrc = new URL(src, url).href; } catch { return; }

    const parents = $(el).parents().toArray().map(p => (p as cheerio.Element & { tagName?: string }).tagName?.toLowerCase() ?? '');
    const isChrome = parents.some(t => ['header', 'nav', 'footer'].includes(t));
    const isContent = parents.some(t => ['main', 'article', 'section'].includes(t));

    rawImageCandidates.push({
      src: resolvedSrc,
      alt: $(el).attr('alt') ?? '',
      naturalWidth: 0,
      naturalHeight: 0,
      semanticContext: isChrome ? 'header' : isContent ? 'main' : 'body',
      isChrome,
      isContent,
    });
  });

  onStep('analyzing_brand');
  const colors = extractColors($);
  const images = filterAndRankImages(rawImageCandidates, 12, url);
  const logoCandidate = images.find(img => img.isLikelyLogo);

  onStep('generating_concept');
  const bodyText = $.text().slice(0, 20_000);
  const contactInfo = extractContactInfo(bodyText);
  const businessName = inferBusinessName(ogSiteName, pageTitle, url);

  logger.info('Crawl complete', { url, imagesFound: images.length });

  return {
    sourceUrl: url,
    pageTitle,
    metaDescription,
    businessName,
    tagline,
    logoUrl: logoCandidate?.src ?? ogImage ?? null,
    faviconUrl,
    images,
    colors,
    contactInfo,
    ogImage,
    keywords,
  };
}
