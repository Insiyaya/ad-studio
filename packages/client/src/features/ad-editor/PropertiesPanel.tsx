/**
 * Properties panel - edits the selected clip's data.
 *
 * Renders different fields based on the clip type:
 *   image   → transition, objectFit
 *   text    → content, fontSize, color, position
 *   audio   → volume, script (read-only)
 *   overlay → visible, position
 *
 * Changes are applied immediately via the updateClip callback.
 */

import React from 'react';
import type { Track, Clip, TextClipData, AudioClipData, OverlayClipData, ImageClipData } from '@shared/types';
import styles from './PropertiesPanel.module.css';

interface PropertiesPanelProps {
  selection: { track: Track; clip: Clip } | null;
  onUpdateClip: (trackId: string, clipId: string, patch: Partial<Clip['data']>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selection,
  onUpdateClip,
}) => {
  if (!selection) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">↖</span>
        <p className={styles.emptyText}>Click a clip to edit its properties</p>
      </div>
    );
  }

  const { track, clip } = selection;
  const update = (patch: Partial<Clip['data']>): void => {
    onUpdateClip(track.id, clip.id, patch);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span
          className={styles.trackDot}
          style={{ backgroundColor: `var(--color-track-${track.type})` }}
          aria-hidden="true"
        />
        <h2 className={styles.title}>{track.label}</h2>
      </div>

      <div className={styles.body}>
        {/* Timing (read-only) */}
        <Section title="Timing">
          <Row label="Start">{clip.startTime.toFixed(1)}s</Row>
          <Row label="Duration">{clip.duration.toFixed(1)}s</Row>
          <Row label="End">{(clip.startTime + clip.duration).toFixed(1)}s</Row>
        </Section>

        {/* Type-specific fields */}
        {clip.data.type === 'text' && (
          <TextProperties data={clip.data as TextClipData} update={update} />
        )}
        {clip.data.type === 'image' && (
          <ImageProperties data={clip.data as ImageClipData} update={update} />
        )}
        {clip.data.type === 'audio' && (
          <AudioProperties data={clip.data as AudioClipData} update={update} />
        )}
        {clip.data.type === 'overlay' && (
          <OverlayProperties data={clip.data as OverlayClipData} update={update} />
        )}
      </div>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>{title}</h3>
    {children}
  </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className={styles.row}>
    <span className={styles.rowLabel}>{label}</span>
    <span className={styles.rowValue}>{children}</span>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className={styles.field}>
    <label className={styles.fieldLabel}>{label}</label>
    {children}
  </div>
);

// Text clip properties
const TextProperties: React.FC<{
  data: TextClipData;
  update: (p: Partial<TextClipData>) => void;
}> = ({ data, update }) => (
  <Section title="Text">
    <Field label="Content">
      <textarea
        className={styles.textarea}
        value={data.content}
        onChange={(e) => update({ content: e.target.value })}
        rows={3}
      />
    </Field>
    <Field label="Font size">
      <input
        type="range"
        className={styles.range}
        min={12}
        max={96}
        value={data.fontSize}
        onChange={(e) => update({ fontSize: parseInt(e.target.value, 10) })}
      />
      <span className={styles.rangeValue}>{data.fontSize}px</span>
    </Field>
    <Field label="Color">
      <div className={styles.colorRow}>
        <input
          type="color"
          className={styles.colorInput}
          value={data.color}
          onChange={(e) => update({ color: e.target.value })}
        />
        <span className={styles.fieldHint}>{data.color}</span>
      </div>
    </Field>
    <Field label="Alignment">
      <div className={styles.segmented}>
        {(['left', 'center', 'right'] as const).map((a) => (
          <button
            key={a}
            className={[styles.segBtn, data.align === a ? styles.segBtnActive : ''].join(' ')}
            onClick={() => update({ align: a })}
          >
            {a[0]?.toUpperCase()}
          </button>
        ))}
      </div>
    </Field>
  </Section>
);

// Image clip properties
const ImageProperties: React.FC<{
  data: ImageClipData;
  update: (p: Partial<ImageClipData>) => void;
}> = ({ data, update }) => (
  <Section title="Image">
    <Field label="Transition">
      <select
        className={styles.select}
        value={data.transition}
        onChange={(e) => update({ transition: e.target.value as ImageClipData['transition'] })}
      >
        <option value="fade">Fade</option>
        <option value="slide">Slide</option>
        <option value="none">None</option>
      </select>
    </Field>
    <Field label="Fit">
      <div className={styles.segmented}>
        {(['cover', 'contain'] as const).map((f) => (
          <button
            key={f}
            className={[styles.segBtn, data.objectFit === f ? styles.segBtnActive : ''].join(' ')}
            onClick={() => update({ objectFit: f })}
          >
            {f}
          </button>
        ))}
      </div>
    </Field>
    <Row label="Source">
      <a
        href={data.src}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
      >
        View original
      </a>
    </Row>
  </Section>
);

// Audio clip properties
const AudioProperties: React.FC<{
  data: AudioClipData;
  update: (p: Partial<AudioClipData>) => void;
}> = ({ data, update }) => (
  <Section title="Audio">
    <Field label="Volume">
      <input
        type="range"
        className={styles.range}
        min={0}
        max={1}
        step={0.01}
        value={data.volume}
        onChange={(e) => update({ volume: parseFloat(e.target.value) })}
      />
      <span className={styles.rangeValue}>{Math.round(data.volume * 100)}%</span>
    </Field>
    {data.script && (
      <Field label="Script">
        <p className={styles.scriptPreview}>{data.script}</p>
      </Field>
    )}
  </Section>
);

// Overlay clip properties
const OverlayProperties: React.FC<{
  data: OverlayClipData;
  update: (p: Partial<OverlayClipData>) => void;
}> = ({ data, update }) => (
  <Section title="Overlay">
    <Field label="Type">
      <span className={styles.fieldHint}>{data.overlayType.toUpperCase()}</span>
    </Field>
    <Field label="Visible">
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={data.visible}
          onChange={(e) => update({ visible: e.target.checked })}
        />
        <span className={styles.toggleSlider} />
      </label>
    </Field>
    <Field label="Content">
      <input
        type="text"
        className={styles.textInput}
        value={data.content}
        onChange={(e) => update({ content: e.target.value })}
      />
    </Field>
  </Section>
);
