/**
 * URL intake page - the entry point for every new ad.
 *
 * Layout:
 *  - Branded header with logo mark
 *  - Hero: headline + URL input form
 *  - Below: example brand tiles (empty state inspiration)
 *
 * On submit → POST /api/crawl → navigate to /crawl/:jobId to show live progress
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@shared/components';
import { apiClient, ApiError } from '@shared/lib/apiClient';
import { useAdStudioStore } from '@shared/lib/store';
import type { CreateCrawlResponseBody } from '@shared/types';
import styles from './UrlIntakePage.module.css';

const EXAMPLE_BRANDS = [
  { name: 'Apple', url: 'https://apple.com', color: '#1d1d1f' },
  { name: 'Stripe', url: 'https://stripe.com', color: '#635bff' },
  { name: 'Vercel', url: 'https://vercel.com', color: '#000000' },
  { name: 'Linear', url: 'https://linear.app', color: '#5e6ad2' },
];

// Basic URL validation - more thorough validation happens on the server
function isValidUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const UrlIntakePage: React.FC = () => {
  const navigate = useNavigate();
  const reset = useAdStudioStore((s) => s.reset);

  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Touched tracks whether the user has blurred the input - avoids showing
  // validation errors before the user has had a chance to type
  const [touched, setTouched] = useState(false);

  const urlError = touched && url.trim() && !isValidUrl(url)
    ? 'Enter a valid URL starting with https://'
    : undefined;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setTouched(true);

    if (!url.trim() || !isValidUrl(url)) return;

    setSubmitting(true);
    setError(null);
    reset(); // Clear any previous project state

    try {
      const data = await apiClient.post<CreateCrawlResponseBody>('/api/crawl', {
        url: url.trim(),
      });
      navigate(`/crawl/${data.jobId}`);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to start crawl. Please try again.';
      setError(message);
      setSubmitting(false);
    }
  };

  const handleExampleClick = (exampleUrl: string): void => {
    setUrl(exampleUrl);
    setTouched(false);
    setError(null);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true">▶</span>
          <span className={styles.logoText}>Ad Studio</span>
        </div>
      </header>

      {/* Hero */}
      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            AI-Powered
          </div>

          <h1 className={styles.headline}>
            Turn any website into
            <br />
            <span className={styles.highlight}>a 30-second ad</span>
          </h1>

          <p className={styles.subline}>
            Paste a business URL. We crawl the site, extract brand assets, and
            generate a professional video ad concept - ready to edit in seconds.
          </p>

          {/* URL form */}
          <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
            <div className={styles.inputRow}>
              <Input
                type="url"
                placeholder="https://your-business.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                onBlur={() => setTouched(true)}
                error={urlError ?? error ?? undefined}
                aria-label="Business website URL"
                className={styles.urlInput}
                autoFocus
                autoComplete="url"
                spellCheck={false}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                disabled={submitting}
                className={styles.submitButton}
              >
                Generate Ad
              </Button>
            </div>
          </form>

          {/* Example brands */}
          <div className={styles.examples}>
            <span className={styles.examplesLabel}>Try an example:</span>
            <div className={styles.exampleList}>
              {EXAMPLE_BRANDS.map((brand) => (
                <button
                  key={brand.url}
                  type="button"
                  className={styles.exampleChip}
                  onClick={() => handleExampleClick(brand.url)}
                >
                  <span
                    className={styles.exampleDot}
                    style={{ backgroundColor: brand.color }}
                    aria-hidden="true"
                  />
                  {brand.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feature callouts */}
        <div className={styles.features}>
          {[
            {
              icon: '🔍',
              title: 'Real crawling',
              desc: 'Puppeteer extracts images, colors, and brand copy from any live URL',
            },
            {
              icon: '🎬',
              title: 'Timeline editor',
              desc: 'Multi-track editor with images, text, voiceover, music, and overlays',
            },
            {
              icon: '📐',
              title: 'Multi-format export',
              desc: '16:9 for CTV, 9:16 for mobile, 1:1 for social - one click',
            },
          ].map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon} aria-hidden="true">{f.icon}</span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};
