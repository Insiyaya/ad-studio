/**
 * Brand color extraction from a live Puppeteer page.
 *
 * Strategy (in priority order):
 * 1. <meta name="theme-color"> — explicit brand signal
 * 2. CSS custom properties with common brand variable names (--primary, --brand-color, etc.)
 * 3. Computed background/foreground colors on structural brand elements (header, nav, CTA buttons)
 *
 * Colors are then filtered (skip near-white, near-black, transparent) and ranked
 * by saturation × brightness balance — the heuristic that identifies brand accent
 * colors versus neutral UI colors.
 */

import type { Page } from 'puppeteer';
import { logger } from '../../config/logger';
import type { BrandColors } from '../../types/crawl';

// ── Internal page-context types (must be serializable for page.evaluate) ──

interface RawColorEntry {
  selector: string;
  background: string;
  color: string;
}

interface RawColorData {
  themeColor: string | null;
  cssVariables: Record<string, string>;
  computedEntries: RawColorEntry[];
  metaExtras: string[];
}

// ── Color normalisation ────────────────────────────────────────────────────

/**
 * Converts an rgb/rgba string to lowercase hex.
 * Returns null if the color is transparent, near-white, or near-black
 * (those are layout colors, not brand colors).
 */
function rgbToHex(rgb: string): string | null {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/.exec(rgb);
  if (!match) return null;

  const r = parseInt(match[1]!, 10);
  const g = parseInt(match[2]!, 10);
  const b = parseInt(match[3]!, 10);
  const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;

  if (alpha < 0.2) return null; // transparent

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness > 235) return null; // near-white (layout bg)
  if (brightness < 20) return null;  // near-black (text/bg)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function expandShortHex(hex: string): string {
  // Expand #abc → #aabbcc
  return `#${hex[1]!}${hex[1]!}${hex[2]!}${hex[2]!}${hex[3]!}${hex[3]!}`;
}

function normaliseColor(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();

  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/.test(trimmed)) return expandShortHex(trimmed);
  if (trimmed.startsWith('rgb')) return rgbToHex(trimmed);

  return null;
}

// ── Ranking ────────────────────────────────────────────────────────────────

/**
 * Scores a hex color by how "brand-like" it is.
 * Brand colors tend to be saturated and mid-brightness — not washed out, not too dark.
 */
function brandScore(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

  // Prefer saturated colors at medium brightness
  const brightnessPenalty = Math.abs(brightness - 0.45) * 1.5;
  return saturation * 0.7 - brightnessPenalty * 0.3;
}

function rankAndDeduplicate(colors: string[]): string[] {
  const normalised = colors
    .map(normaliseColor)
    .filter((c): c is string => c !== null);

  const unique = [...new Set(normalised)];

  return unique.sort((a, b) => brandScore(b) - brandScore(a)).slice(0, 8);
}

// ── Main export ────────────────────────────────────────────────────────────

export async function extractBrandColors(page: Page): Promise<BrandColors> {
  try {
    // Everything inside page.evaluate runs in the browser context —
    // no Node.js APIs are available there.
    const rawData = await page.evaluate((): RawColorData => {
      // 1. Meta theme-color
      const themeColorEl = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      const themeColor = themeColorEl?.content?.trim() ?? null;

      // 2. CSS custom properties from :root — common naming conventions
      const cssVariables: Record<string, string> = {};
      const brandVarNames = [
        '--color-primary', '--primary-color', '--brand-color', '--color-brand',
        '--color-accent', '--accent-color', '--color-main', '--main-color',
        '--primary', '--accent', '--brand', '--highlight',
        '--color-secondary', '--secondary-color',
      ];

      try {
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules ?? [])) {
              if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
                for (const varName of brandVarNames) {
                  const val = rule.style.getPropertyValue(varName).trim();
                  if (val) cssVariables[varName] = val;
                }
              }
            }
          } catch {
            // Cross-origin stylesheet — browser blocks cssRules access, skip
          }
        }
      } catch {
        // styleSheets access may fail in some contexts
      }

      // 3. Computed colors from structural brand elements
      const brandSelectors = [
        'header', 'nav',
        '[class*="header"]', '[class*="navbar"]', '[class*="nav-"]',
        '[class*="hero"]', '[class*="banner"]', '[class*="jumbotron"]',
        'button[class*="primary"]', '[class*="btn-primary"]',
        'a[class*="cta"]', '[class*="cta"]',
      ];

      const computedEntries: RawColorEntry[] = [];
      for (const selector of brandSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          const styles = window.getComputedStyle(el);
          computedEntries.push({
            selector,
            background: styles.backgroundColor,
            color: styles.color,
          });
        } catch {
          // Invalid selectors or access issues
        }
      }

      // 4. Extra meta hints
      const metaExtras: string[] = [];
      const ogColor = document.querySelector<HTMLMetaElement>('meta[property="og:color"]');
      if (ogColor?.content) metaExtras.push(ogColor.content);

      return { themeColor, cssVariables, computedEntries, metaExtras };
    });

    // Collect all colour candidates into one array for ranking
    const candidates: string[] = [];

    if (rawData.themeColor) candidates.push(rawData.themeColor);
    candidates.push(...rawData.metaExtras);
    candidates.push(...Object.values(rawData.cssVariables));

    for (const entry of rawData.computedEntries) {
      if (entry.background) candidates.push(entry.background);
      if (entry.color) candidates.push(entry.color);
    }

    const ranked = rankAndDeduplicate(candidates);

    return {
      primary: ranked[0] ?? null,
      secondary: ranked[1] ?? null,
      background: ranked[2] ?? null,
      text: ranked[3] ?? null,
      all: ranked,
    };
  } catch (err) {
    logger.warn('Brand color extraction failed — returning empty palette', { err });
    return { primary: null, secondary: null, background: null, text: null, all: [] };
  }
}
