/**
 * Ad preview page - the first thing the user sees after a successful crawl.
 *
 * Shows:
 * - Custom canvas video player (play, pause, scrub, fullscreen)
 * - Extracted brand assets panel (colors, images, contact info)
 * - Actions: Edit Ad, Regenerate (mock)
 *
 * Loading state: skeleton screens while the project fetches.
 * Error state: retry button + helpful message.
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdProject } from '@shared/hooks/useAdProject';
import { Button, Skeleton, Badge } from '@shared/components';
import { useVideoPlayer, type BrandData } from './hooks/useVideoPlayer';
import styles from './AdPreviewPage.module.css';

// ── Sub-component: custom player controls ─────────────────────────────────

interface PlayerProps {
  timeline: import('@shared/types').AdTimeline;
  brand: BrandData;
}

const VideoPlayer: React.FC<PlayerProps> = ({ timeline, brand }) => {
  const { canvasRef, playing, currentTime, duration, play, pause, seek, toggleFullscreen } =
    useVideoPlayer({ timeline, brand });

  const formatTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.player}>
      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={960}
          height={540}
          aria-label="Ad preview"
        />
        {/* Click canvas to toggle play/pause */}
        <button
          className={styles.canvasOverlay}
          onClick={() => (playing ? pause() : play())}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {!playing && (
            <span className={styles.playIcon} aria-hidden="true">
              ▶
            </span>
          )}
        </button>
      </div>

      {/* Controls bar */}
      <div className={styles.controls}>
        <button
          className={styles.controlButton}
          onClick={() => (playing ? pause() : play())}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : '▶'}
        </button>

        {/* Scrub bar */}
        <div className={styles.scrubWrapper}>
          <input
            type="range"
            className={styles.scrubBar}
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            aria-label="Seek"
          />
        </div>

        <span className={styles.timestamp}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <button
          className={styles.controlButton}
          onClick={toggleFullscreen}
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          ⛶
        </button>
      </div>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────

export const AdPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { project, loading, error, reload } = useAdProject(id ?? null);
  const [showRegenModal, setShowRegenModal] = useState(false);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <Skeleton width={100} height={20} />
          <Skeleton width={200} height={20} />
          <Skeleton width={160} height={36} />
        </div>
        <div className={styles.body}>
          <div className={styles.playerArea}>
            <Skeleton width="100%" height={400} borderRadius="12px" />
          </div>
          <div className={styles.sidebar}>
            <Skeleton width="100%" height={200} borderRadius="12px" />
            <Skeleton width="100%" height={150} borderRadius="12px" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState}>
          <p className={styles.errorText}>
            {error ?? 'Project not found'}
          </p>
          <Button variant="secondary" onClick={reload}>
            Retry
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Start over
          </Button>
        </div>
      </div>
    );
  }

  const { brandAssets } = project;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backLink} onClick={() => navigate('/')}>
          ← New Ad
        </button>
        <h1 className={styles.projectName}>{project.name}</h1>
        <div className={styles.headerActions}>
        </div>
      </header>

      {/* Body */}
      <div className={styles.body}>
        {/* Left: player */}
        <div className={styles.playerArea}>
          <VideoPlayer
            timeline={project.timeline}
            brand={{
              primaryColor: project.brandAssets.colors.primary ?? '#FF2D3C',
              logoUrl: project.brandAssets.logoUrl,
            }}
          />

          {/* Voiceover script */}
          {project.voiceoverScript && (
            <div className={styles.scriptBox}>
              <div className={styles.scriptHeader}>
                <Badge variant="secondary" dot>AI Script</Badge>
              </div>
              <p className={styles.scriptText}>{project.voiceoverScript}</p>
            </div>
          )}
        </div>

        {/* Right: brand assets */}
        <aside className={styles.sidebar}>
          {/* Business info */}
          <div className={styles.sideSection}>
            <h2 className={styles.sideSectionTitle}>Brand</h2>
            <div className={styles.brandInfo}>
              {brandAssets.logoUrl && (
                <img
                  src={brandAssets.logoUrl}
                  alt={brandAssets.businessName}
                  className={styles.brandLogo}
                />
              )}
              <div>
                <p className={styles.businessName}>{brandAssets.businessName}</p>
                {brandAssets.tagline && (
                  <p className={styles.tagline}>{brandAssets.tagline}</p>
                )}
              </div>
            </div>
            {brandAssets.metaDescription && (
              <p className={styles.description}>{brandAssets.metaDescription}</p>
            )}
          </div>

          {/* Brand colors */}
          <div className={styles.sideSection}>
            <h2 className={styles.sideSectionTitle}>Brand Colors</h2>
            <div className={styles.colorRow}>
              {brandAssets.colors.all.slice(0, 6).map((color) => (
                <div
                  key={color}
                  className={styles.colorSwatch}
                  style={{ backgroundColor: color }}
                  title={color}
                  aria-label={color}
                />
              ))}
              {brandAssets.colors.all.length === 0 && (
                <p className={styles.emptyHint}>No brand colors detected</p>
              )}
            </div>
          </div>

          {/* Extracted images */}
          <div className={styles.sideSection}>
            <h2 className={styles.sideSectionTitle}>
              Extracted Images
              <Badge variant="neutral" size="sm">{brandAssets.images.length}</Badge>
            </h2>
            <div className={styles.imageGrid}>
              {brandAssets.images.slice(0, 6).map((img) => (
                <div key={img.src} className={styles.imageThumb}>
                  <img
                    src={img.src}
                    alt={img.alt || brandAssets.businessName}
                    className={styles.thumbImg}
                  />
                </div>
              ))}
            </div>
            {brandAssets.images.length === 0 && (
              <p className={styles.emptyHint}>No content images found at this URL</p>
            )}
          </div>

          {/* Contact */}
          {(brandAssets.contactInfo.email ??
            brandAssets.contactInfo.phone ??
            brandAssets.contactInfo.address) && (
            <div className={styles.sideSection}>
              <h2 className={styles.sideSectionTitle}>Contact</h2>
              <dl className={styles.contactList}>
                {brandAssets.contactInfo.email && (
                  <>
                    <dt>Email</dt>
                    <dd>{brandAssets.contactInfo.email}</dd>
                  </>
                )}
                {brandAssets.contactInfo.phone && (
                  <>
                    <dt>Phone</dt>
                    <dd>{brandAssets.contactInfo.phone}</dd>
                  </>
                )}
                {brandAssets.contactInfo.address && (
                  <>
                    <dt>Address</dt>
                    <dd>{brandAssets.contactInfo.address}</dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </aside>
      </div>

      {/* Regenerate modal (mock) */}
      {showRegenModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowRegenModal(false)}>
          <div className={styles.regenModal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.regenTitle}>Regenerate Ad</h2>
            <p className={styles.regenDesc}>
              Choose a different style or tone for the ad concept.
            </p>
            {['Professional', 'Energetic', 'Warm', 'Luxury'].map((tone) => (
              <button
                key={tone}
                className={styles.regenOption}
                onClick={() => setShowRegenModal(false)}
              >
                {tone}
              </button>
            ))}
            <Button variant="ghost" onClick={() => setShowRegenModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
