/**
 * Crawler service — the core of the URL-to-Ad pipeline.
 *
 * Responsibilities:
 * 1. Launch a headless Chromium instance via Puppeteer
 * 2. Navigate to the target URL and wait for the page to settle
 * 3. Extract brand assets: title, meta, images, logo, favicon, contact info
 * 4. Delegate colour extraction to colorExtractor
 * 5. Delegate image filtering/scoring to assetFilter
 * 6. Return a typed ExtractedBrandAssets object
 *
 * WHY Puppeteer over a plain HTTP fetch + cheerio:
 * Most modern marketing sites are SPA or heavily JS-rendered. A static HTML
 * fetch would miss hero images, lazy-loaded content, and computed CSS colours.
 * Puppeteer gives us a real browser environment.
 */

import { existsSync } from 'fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { extractBrandColors } from './colorExtractor';
import { filterAndRankImages, type RawImageCandidate } from './assetFilter';
import type { ExtractedBrandAssets, ContactInfo } from '../../types/crawl';

// ── Browser singleton ─────────────────────────────────────────────────────
// WHY a singleton: launching a new browser per request is ~2s overhead and
// exhausts file descriptors quickly. One browser, many pages.

let browserInstance: Browser | null = null;

/**
 * Resolve a Chrome executable that will actually launch on this OS.
 *
 * Priority order:
 *  1. Explicit PUPPETEER_EXECUTABLE_PATH env var (production / Docker)
 *  2. Well-known macOS system Chrome paths (avoids the bundled binary which
 *     may be too old for the current macOS release)
 *  3. puppeteer.executablePath() — the binary Puppeteer downloaded to
 *     ~/.cache/puppeteer at install time
 */
function resolveChromePath(): string {
  if (env.puppeteer.executablePath) {
    return env.puppeteer.executablePath;
  }

  const systemCandidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  const systemChrome = systemCandidates.find((p) => existsSync(p));
  if (systemChrome) {
    return systemChrome;
  }

  // Last resort: bundled binary (may be too old on macOS 15+)
  return puppeteer.executablePath();
}

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  const executablePath = resolveChromePath();
  logger.info('Launching Puppeteer browser instance', { executablePath });

  browserInstance = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Required in Docker/Oracle Container Instances
      '--disable-extensions',
      '--no-first-run',
      // NOTE: --no-zygote is intentionally omitted — it breaks Chrome on macOS ARM.
      // It is safe to add back for Linux containers (Docker/Oracle CI).
    ],
  });

  browserInstance.on('disconnected', () => {
    logger.warn('Puppeteer browser disconnected — will relaunch on next request');
    browserInstance = null;
  });

  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// ── Contact info extraction ───────────────────────────────────────────────

interface PageTextData {
  bodyText: string;
  schemaOrgJson: string[];
}

function extractContactInfo(data: PageTextData): ContactInfo {
  const { bodyText, schemaOrgJson } = data;

  // Email: standard RFC-ish pattern, avoid matching image filenames
  const emailMatch = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/.exec(bodyText);

  // Phone: handles US, international, and common formatting variations
  const phoneMatch =
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{1,3}[-.\s]\d{2,4}[-.\s]\d{4,8})/.exec(
      bodyText
    );

  // Address: look in schema.org JSON-LD first (more reliable than regex on body)
  let address: string | null = null;
  for (const json of schemaOrgJson) {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      const addrObj = parsed['address'] as Record<string, unknown> | undefined;
      if (addrObj && typeof addrObj['streetAddress'] === 'string') {
        const parts = [
          addrObj['streetAddress'],
          addrObj['addressLocality'],
          addrObj['addressRegion'],
          addrObj['postalCode'],
        ]
          .filter(Boolean)
          .join(', ');
        address = parts || null;
        break;
      }
    } catch {
      // Malformed JSON-LD — skip
    }
  }

  return {
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[0] ?? null,
    address,
  };
}

// ── Business name heuristic ───────────────────────────────────────────────

function inferBusinessName(
  ogSiteName: string | null,
  pageTitle: string,
  url: string
): string {
  if (ogSiteName) return ogSiteName;

  // Common title patterns: "Page Name | Business" or "Business - Page Name"
  const separatorMatch = /^(.+?)\s*[\|–—-]\s*(.+)$/.exec(pageTitle);
  if (separatorMatch) {
    // Return the shorter segment — usually the brand name
    const [, a, b] = separatorMatch;
    return (a!.length <= b!.length ? a : b) ?? pageTitle;
  }

  // Fall back to domain name without TLD
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const domain = hostname.split('.')[0] ?? hostname;
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return pageTitle;
  }
}

// ── Page metadata extraction (runs inside browser context) ───────────────

interface PageMetadata {
  pageTitle: string;
  metaDescription: string;
  ogSiteName: string | null;
  ogImage: string | null;
  tagline: string | null;
  keywords: string[];
  faviconUrl: string | null;
  bodyText: string;
  schemaOrgJson: string[];
  rawImageCandidates: RawImageCandidate[];
}

async function extractPageMetadata(page: Page, baseUrl: string): Promise<PageMetadata> {
  return page.evaluate((base: string): PageMetadata => {
    function getMeta(selector: string): string | null {
      return (
        document.querySelector<HTMLMetaElement>(selector)?.content?.trim() ?? null
      );
    }

    function resolveUrl(href: string | null | undefined): string | null {
      if (!href) return null;
      try {
        return new URL(href, base).href;
      } catch {
        return null;
      }
    }

    // ── Meta ──────────────────────────────────────────────────────────────
    const pageTitle = document.title.trim();
    const metaDescription =
      getMeta('meta[name="description"]') ??
      getMeta('meta[property="og:description"]') ??
      '';
    const ogSiteName = getMeta('meta[property="og:site_name"]');
    const ogImage = resolveUrl(getMeta('meta[property="og:image"]'));

    // Tagline candidates: hero heading or meta slogan
    const heroH1 = document.querySelector<HTMLElement>(
      'header h1, [class*="hero"] h1, [class*="banner"] h1, main h1'
    );
    const tagline = heroH1?.textContent?.trim() ?? getMeta('meta[name="slogan"]') ?? null;

    const keywordsRaw = getMeta('meta[name="keywords"]') ?? '';
    const keywords = keywordsRaw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 10);

    // ── Favicon ───────────────────────────────────────────────────────────
    const faviconEl =
      document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
      document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]') ??
      document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    const faviconUrl = resolveUrl(faviconEl?.href) ?? resolveUrl('/favicon.ico');

    // ── Contact text + schema ─────────────────────────────────────────────
    const bodyText = (document.body?.innerText ?? '').slice(0, 20_000);
    const schemaOrgJson = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
    ).map((el) => el.textContent ?? '');

    // ── Images ────────────────────────────────────────────────────────────
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img'));
    const rawImageCandidates: RawImageCandidate[] = imgs.map((img) => {
      // Walk up the DOM to find the closest semantic ancestor
      let el: Element | null = img;
      let semanticContext = 'body';
      let isChrome = false;
      let isContent = false;

      while (el && el !== document.documentElement) {
        const tag = el.tagName.toLowerCase();
        if (['header', 'nav', 'footer'].includes(tag)) {
          isChrome = true;
          semanticContext = tag;
          break;
        }
        if (['main', 'article', 'section'].includes(tag)) {
          isContent = true;
          semanticContext = tag;
          break;
        }
        el = el.parentElement;
      }

      return {
        src: resolveUrl(img.src) ?? img.src,
        alt: img.alt ?? '',
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        semanticContext,
        isChrome,
        isContent,
      };
    });

    return {
      pageTitle,
      metaDescription,
      ogSiteName,
      ogImage,
      tagline,
      keywords,
      faviconUrl,
      bodyText,
      schemaOrgJson,
      rawImageCandidates,
    };
  }, baseUrl);
}

// ── Public API ────────────────────────────────────────────────────────────

export interface CrawlProgressCallback {
  (step: 'connecting' | 'extracting_assets' | 'analyzing_brand' | 'generating_concept'): void;
}

export async function crawlUrl(
  url: string,
  onStep: CrawlProgressCallback
): Promise<ExtractedBrandAssets> {
  let page: Page | null = null;

  try {
    onStep('connecting');
    logger.info('Starting crawl', { url });

    const browser = await getBrowser();
    page = await browser.newPage();

    // Block non-essential resource types to speed up crawl
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['font', 'media', 'websocket'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (compatible; AdStudioBot/1.0; +https://ad.studio/bot)'
    );

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: env.puppeteer.timeoutMs,
    });

    onStep('extracting_assets');
    logger.debug('Page loaded — extracting assets', { url });

    const metadata = await extractPageMetadata(page, url);

    onStep('analyzing_brand');
    logger.debug('Assets extracted — analysing brand colours', { url });

    const colors = await extractBrandColors(page);

    const images = filterAndRankImages(metadata.rawImageCandidates, 12, url);

    // Best logo candidate: highest-scoring image flagged as likely logo,
    // or the OG image as a fallback
    const logoCandidate = images.find((img) => img.isLikelyLogo);

    onStep('generating_concept');
    logger.debug('Brand analysis complete — assembling result', { url });

    const contactInfo = extractContactInfo({
      bodyText: metadata.bodyText,
      schemaOrgJson: metadata.schemaOrgJson,
    });

    const businessName = inferBusinessName(
      metadata.ogSiteName,
      metadata.pageTitle,
      url
    );

    const result: ExtractedBrandAssets = {
      sourceUrl: url,
      pageTitle: metadata.pageTitle,
      metaDescription: metadata.metaDescription,
      businessName,
      tagline: metadata.tagline,
      logoUrl: logoCandidate?.src ?? metadata.ogImage ?? null,
      faviconUrl: metadata.faviconUrl,
      images,
      colors,
      contactInfo,
      ogImage: metadata.ogImage,
      keywords: metadata.keywords,
    };

    logger.info('Crawl complete', {
      url,
      imagesFound: images.length,
      hasPrimaryColor: !!colors.primary,
    });

    return result;
  } finally {
    // Always close the page — never leak browser tabs
    if (page) {
      await page.close().catch((err: unknown) => {
        logger.warn('Failed to close page after crawl', { err });
      });
    }
  }
}
