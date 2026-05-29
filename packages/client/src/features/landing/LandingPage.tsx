/**
 * Landing page - marketing entry point for Ad Studio.
 *
 * Red / black / white theme, isolated from the in-app token system.
 * The URL form calls /api/crawl directly and navigates to the crawl
 * progress view on success - same flow as UrlIntakePage.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '@shared/lib/apiClient';
import { useAdStudioStore } from '@shared/lib/store';
import type { CreateCrawlResponseBody } from '@shared/types';
import styles from './LandingPage.module.css';

// ── Static data ──────────────────────────────────────────────────────────────

const BRANDS = [
  { name: 'Apple',   bg: '#fff', mark: '⌘', fg: '#000' },
  { name: 'Stripe',  bg: '#635bff', mark: 'S' },
  { name: 'Vercel',  bg: '#000', mark: '▲' },
  { name: 'Linear',  bg: '#5e6ad2', mark: 'L' },
  { name: 'Notion',  bg: '#fff', mark: 'N', fg: '#000' },
  { name: 'Figma',   bg: '#F24E1E', mark: 'F' },
  { name: 'Spotify', bg: '#1DB954', mark: '♫' },
  { name: 'Shopify', bg: '#96bf48', mark: 'S' },
  { name: 'Airbnb',  bg: '#FF5A5F', mark: 'A' },
  { name: 'Framer',  bg: '#0055FF', mark: 'F' },
];

interface GalleryItem {
  brand: string; title: string; bg: string;
  glyph: keyof typeof GLYPHS;
}
const GALLERY: GalleryItem[] = [
  { brand: 'LUMA GOODS',  title: 'Soft. Strong. Yours.',  bg: 'linear-gradient(135deg,#2a0a0e,#0a0a0a)',              glyph: 'product' },
  { brand: 'NORTHWAVE',   title: 'Ride the wave.',        bg: 'linear-gradient(180deg,#3d0810,#000)',                 glyph: 'wave'    },
  { brand: 'PAPRIKA',     title: 'Spice, simplified.',    bg: 'linear-gradient(135deg,#FF2D3C,#8B0E18)',              glyph: 'spice'   },
  { brand: 'MERIDIAN',    title: '47% faster.',           bg: 'linear-gradient(135deg,#1a1a1a,#000)',                 glyph: 'speed'   },
  { brand: 'ORBIT',       title: 'Launch in 3.',          bg: 'linear-gradient(180deg,#000,#2a0a0e)',                 glyph: 'orbit'   },
  { brand: 'PIER 42',     title: 'Dine where locals do.', bg: 'linear-gradient(135deg,#0a0a0a,#3d0810)',              glyph: 'plate'   },
  { brand: 'AETHER',      title: 'Breathe better.',       bg: 'radial-gradient(circle at 50% 30%,#FF2D3C,#000 70%)', glyph: 'wave'    },
  { brand: 'KINDLE & CO', title: 'Handmade, always.',     bg: 'linear-gradient(135deg,#1a1a1a,#2a0a0e)',             glyph: 'flame'   },
  { brand: 'HALFTIME',    title: 'Cut it. Keep it.',      bg: 'linear-gradient(45deg,#FF2D3C 50%,#0a0a0a 50%)',      glyph: 'cut'     },
  { brand: 'REMEDY',      title: 'Feel like yourself.',   bg: 'linear-gradient(180deg,#2a0a0e,#0a0a0a)',             glyph: 'pill'    },
  { brand: 'SIGNAL',      title: 'Hear the difference.',  bg: 'linear-gradient(135deg,#000,#1a0608)',                glyph: 'wave'    },
  { brand: 'FIELDNOTES',  title: 'Write it down.',        bg: 'linear-gradient(135deg,#1a1a1a,#000)',                glyph: 'pen'     },
];

const GLYPHS = {
  product: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l3 7h7l-5.5 4.5L18 22l-6-4-6 4 1.5-8.5L2 9h7z"/></svg>,
  wave:    <svg width="80" height="32" viewBox="0 0 80 32" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M0 16 Q 10 0, 20 16 T 40 16 T 60 16 T 80 16"/></svg>,
  spice:   <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/><circle cx="6" cy="8" r="1.5"/><circle cx="18" cy="8" r="1.5"/><circle cx="6" cy="16" r="1.5"/><circle cx="18" cy="16" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="12" cy="20" r="1.5"/></svg>,
  speed:   <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2L4 14h8l-2 8 9-12h-8l2-8z"/></svg>,
  orbit:   <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>,
  plate:   <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>,
  flame:   <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s4 4 4 9a4 4 0 0 1-8 0c0-2 1-3 1-3s-3 2-3 5a6 6 0 0 0 12 0c0-6-6-11-6-11z"/></svg>,
  cut:     <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>,
  pill:    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="8" width="18" height="8" rx="4" fill="currentColor"/></svg>,
  pen:     <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>,
};

// ── URL validation ────────────────────────────────────────────────────────────

function isValidUrl(raw: string): boolean {
  try {
    const p = new URL(raw.trim());
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

// ── Icon helper ───────────────────────────────────────────────────────────────

const Icon: React.FC<{ d: string | string[]; size?: number }> = ({ d, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((path, i) => <path key={i} d={path} />)}
  </svg>
);

// ── Orbit chip ────────────────────────────────────────────────────────────────

interface OrbitChipProps { label: string; delay: string; whiteDot?: boolean; }
const OrbitChip: React.FC<OrbitChipProps> = ({ label, delay, whiteDot }) => (
  <div className={styles.orbitChip} style={{ '--r': '220px', animationDelay: delay } as React.CSSProperties}>
    <div className={styles.chipBody} style={{ animationDelay: delay }}>
      <span className={styles.chipDot} style={whiteDot ? { background: '#fff' } : undefined} />
      {label}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const reset = useAdStudioStore((s) => s.reset);

  const [url, setUrl]             = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [urlError, setUrlError]   = useState<string | null>(null);
  const [touched, setTouched]     = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  // Scroll reveal - uses data-reveal attribute so the hashed CSS class name
  // doesn't need to appear in querySelector.
  useEffect(() => {
    const revealClass = styles.in ?? 'in';
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add(revealClass); }),
      { threshold: 0.12 },
    );
    const els = pageRef.current?.querySelectorAll('[data-reveal]') ?? [];
    els.forEach((el) => io.observe(el));
    const timer = setTimeout(() => els.forEach((el) => el.classList.add(revealClass)), 1200);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, []);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setTouched(true);
    if (!url.trim() || !isValidUrl(url)) {
      setUrlError('Enter a valid URL starting with https://');
      return;
    }
    setSubmitting(true);
    setUrlError(null);
    reset();
    try {
      const data = await apiClient.post<CreateCrawlResponseBody>('/api/crawl', { url: url.trim() });
      navigate(`/crawl/${data.jobId}`);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to start crawl. Please try again.';
      setUrlError(msg);
      setSubmitting(false);
    }
  };

  const inputError = touched && url && !isValidUrl(url)
    ? 'Enter a valid URL starting with https://'
    : (urlError ?? null);

  return (
    <div className={styles.page} ref={pageRef}>
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <a href="/" className={styles.logo}>
          <div className={styles.logoMark} />
          Ad Studio<span className={styles.logoDot} />
        </a>
        <div className={styles.navLinks}>
          <a href="#how"      className={styles.navLink}>How it works</a>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#gallery"  className={styles.navLink}>Gallery</a>
          <a href="#pricing"  className={styles.navLink}>Pricing</a>
        </div>
        <div className={styles.navCta}>
          <a className={`${styles.btn} ${styles.btnGhost}`} href="#">Sign in</a>
          <a className={`${styles.btn} ${styles.btnPrimary}`} href="#hero-form">Start free →</a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          {/* Left: copy + form */}
          <div>
            <div className={styles.chip}><span className={styles.recDot} /> REC · LIVE · 30 SECONDS TO AIR</div>
            <h1 className={styles.headline}>
              One URL.<br />
              One{' '}
              <span className={styles.rotor}>
                <span className={styles.rotorInner}>
                  <span>ad.</span><span>spot.</span><span>reel.</span><span>hook.</span><span>ad.</span>
                </span>
              </span>
            </h1>
            <p className={styles.subline}>
              Paste your site. Ad Studio crawls it, writes the script, composes the cut, and hands
              you a broadcast-ready 30-second ad - before your coffee is cold.
            </p>

            <form id="hero-form" className={styles.urlForm} onSubmit={(e) => void handleSubmit(e)} noValidate>
              <div className={styles.urlInputWrap}>
                <Icon d={['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z']} size={18} />
                <input
                  className={styles.urlInput}
                  type="url"
                  placeholder="https://your-business.com"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
                  onBlur={() => setTouched(true)}
                  autoComplete="url"
                  spellCheck={false}
                  aria-label="Business website URL"
                />
              </div>
              <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`} type="submit" disabled={submitting}>
                {submitting
                  ? <><span className={styles.btnSpinner} />&nbsp;&nbsp;Crawling…</>
                  : <>Generate <Icon d={['M5 12h14', 'm12 5 7 7-7 7']} size={18} /></>
                }
              </button>
            </form>
            {inputError && <p className={styles.urlError}>{inputError}</p>}

            <div className={styles.heroMeta}>
              <span><b>5 free ads</b> / month</span>
              <span className={styles.dotSep}>•</span>
              <span>No credit card</span>
              <span className={styles.dotSep}>•</span>
              <span>4.9 ★ · 2,400 creators</span>
            </div>
          </div>

          {/* Right: animated ad preview */}
          <div className={styles.heroRight}>
            <div className={styles.orbit} aria-hidden="true">
              <div className={`${styles.orbitRing} ${styles.r1}`} />
              <div className={`${styles.orbitRing} ${styles.r2}`} />
              <OrbitChip label="hero.jpg · 1920×1080" delay="0s" />
              <OrbitChip label='"Built for speed."'   delay="-10s" whiteDot />
              <OrbitChip label="voiceover.mp3 · 22s"  delay="-20s" />
              <OrbitChip label="#FF2D3C primary"       delay="-30s" whiteDot />
            </div>

            <div className={styles.adPreview}>
              <div className={styles.adScreen}>
                <div className={styles.adTop}>
                  <span className={styles.recLabel}>REC · 00:00:12</span>
                  <span>16:9</span>
                </div>
                <div className={styles.adStage}>
                  <div className={styles.scene}>
                    <div className={styles.bigWord}>
                      READY?<span className={styles.subWord}>- a 30s spot for your brand</span>
                    </div>
                  </div>
                  <div className={styles.scene}>
                    <div className={styles.prodRender}>
                      <svg width="50%" height="50%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 2l3 7h7l-5.5 4.5L18 22l-6-4-6 4 1.5-8.5L2 9h7z"/></svg>
                    </div>
                  </div>
                  <div className={styles.scene}>
                    <div className={styles.bigWord}>
                      47%<br />FASTER<span className={styles.subWord}>than the industry average</span>
                    </div>
                  </div>
                  <div className={styles.scene}>
                    <div className={styles.bigWord} style={{ fontSize: 32 }}>
                      GET YOURS<br />TODAY<span className={styles.redPill}>ACME.COM</span>
                    </div>
                  </div>
                </div>
                <div className={styles.adBottom}>
                  <div className={styles.adProgress} />
                  <div className={styles.adScrub}>
                    <span className={styles.time}>00:12</span>
                    <div className={styles.waveform}>{Array.from({ length: 7 }, (_, i) => <span key={i} />)}</div>
                    <span>00:30</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${styles.floatTag} ${styles.ft1}`}>
              <span className={styles.swatch} style={{ background: '#FF2D3C' }} />Primary #FF2D3C
            </div>
            <div className={`${styles.floatTag} ${styles.ft2}`}>
              <Icon d="M20 6L9 17l-5-5" size={14} />Brand voice: confident
            </div>
            <div className={`${styles.floatTag} ${styles.ft3}`}>
              <Icon d={['M12 2v20', 'M5 9l7-7 7 7']} size={14} />+3 exports ready
            </div>
            <div className={styles.badgeShip}>
              <Icon d="M20 6L9 17l-5-5" size={14} />SHIPPED
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ─────────────────────────────────────────── */}
      <section className={styles.marqueeSection}>
        <div className={styles.marqueeLabel}>Trusted by creative teams at</div>
        <div className={styles.marquee}>
          <div className={styles.marqueeTrack}>
            {[...BRANDS, ...BRANDS].map((b, i) => (
              <div key={i} className={styles.marqueeItem}>
                <span className={styles.mLogo} style={{ background: b.bg, color: b.fg ?? '#fff' }}>{b.mark}</span>
                {b.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pipeline ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
          <div className={styles.eyebrow}>The Pipeline</div>
          <h2 className={styles.sectionTitle}>URL in. <span className={styles.redWord}>Ad out.</span></h2>
          <p className={styles.sectionSub}>A single click runs the full production pipeline. No exports, no handoffs, no stitching.</p>
        </div>
        <div className={`${styles.pipeline} ${styles.reveal}`} data-reveal>
          <PipelineRow nodes={[
            { icon: <Icon d={['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z','M2 12h20','M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z']} />, label: 'Crawl',   sub: '2–4 s' },
            null,
            { icon: <Icon d={['M3 3h18v18H3z','M3 9h18','M9 21V9']} />,                                                                                                                                                                                                                 label: 'Extract',  sub: '1–2 s' },
            null,
            { icon: <Icon d="M12 2l3 7h7l-5.5 4.5L18 22l-6-4-6 4 1.5-8.5L2 9h7z" />,                                                                                                                                                                                                  label: 'Script',   sub: '3–5 s' },
          ]} />
          <PipelineRow nodes={[
            { icon: <Icon d={['M2 6h14v12H2z','m22 8-6 4 6 4V8Z']} />, label: 'Compose', sub: '2–3 s' },
            null,
            { icon: <Icon d={['M12 3v12','M7 10l5 5 5-5','M5 21h14']} />, label: 'Shipped', sub: '~12 s total', highlight: true },
            null,
            null,
          ]} />
        </div>
      </section>

      {/* ── Gallery ──────────────────────────────────────────── */}
      <section className={styles.section} id="gallery" style={{ paddingTop: 0 }}>
        <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
          <div className={styles.eyebrow}>Live Gallery</div>
          <h2 className={styles.sectionTitle}>140,000 ads shipped.<br /><span className={styles.redWord}>Here are 12.</span></h2>
          <p className={styles.sectionSub}>A sample of what Ad Studio generated this week - auto-pulled from public creator output.</p>
        </div>
        <div className={`${styles.gallery} ${styles.reveal}`} data-reveal>
          {GALLERY.map((a, i) => (
            <div key={a.brand} className={styles.adCard}>
              <div className={styles.adFill} style={{ background: a.bg, color: 'rgba(255,255,255,0.85)', animation: `prodFloat ${3 + (i % 4) * 0.4}s ease-in-out ${i * 0.15}s infinite` }}>
                {GLYPHS[a.glyph]}
              </div>
              <span className={styles.adBrand}>{a.brand}</span>
              <span className={styles.adDuration}>0:30</span>
              <div className={styles.adTitle}>{a.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className={styles.section} id="features" style={{ paddingTop: 0 }}>
        <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
          <div className={styles.eyebrow}>Features</div>
          <h2 className={styles.sectionTitle}>Every ad, end-to-end.</h2>
          <p className={styles.sectionSub}>From crawl to composition, Ad Studio handles the pipeline so your team can focus on story, not tooling.</p>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.num} className={`${styles.featureCard} ${styles.reveal}`} data-reveal>
              <span className={styles.featureNum}>{f.num}</span>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Editor split ─────────────────────────────────────── */}
      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.split}>
          <div className={`${styles.splitText} ${styles.reveal}`} data-reveal>
            <div className={styles.eyebrow}>Timeline Editor</div>
            <h2>Fine-tune, don't <span className={styles.redWord}>start over.</span></h2>
            <p>Every generated ad drops into a real timeline with five tracks. Drag clips, trim, remix, mute - the drafts you love stay untouched.</p>
            <ul className={styles.splitList}>
              <li>Drag-and-drop images, copy, VO, music</li>
              <li>30-level undo / redo, autosave every 2 s</li>
              <li>Regenerate a single clip without re-rendering the spot</li>
              <li>Keyframe opacity, scale and position on any clip</li>
            </ul>
          </div>
          <div className={`${styles.editorMock} ${styles.reveal}`} data-reveal>
            <div className={styles.editorChrome}>
              <div className={`${styles.tl} ${styles.tlActive}`} /><div className={styles.tl} /><div className={styles.tl} />
              <div className={styles.editorTitle}>ad-studio / drafts / acme-v3.ads</div>
            </div>
            <div className={styles.editorBody}>
              <div className={styles.editorStage}><div className={styles.stageWord}>ACME</div></div>
              <div className={styles.editorTracks}>
                <div className={styles.trackLabels}>
                  {['IMG','TXT','V.O.','MUSIC'].map((l) => <div key={l} className={styles.trackLabel}>{l}</div>)}
                </div>
                <div className={styles.trackLanes} style={{ position: 'relative' }}>
                  <div className={styles.trackLane}>
                    <div className={`${styles.clip} ${styles.clipI}`} style={{ left: '2%',  width: '28%' }}>hero.jpg</div>
                    <div className={`${styles.clip} ${styles.clipI}`} style={{ left: '32%', width: '40%' }}>product.png</div>
                    <div className={`${styles.clip} ${styles.clipI}`} style={{ left: '74%', width: '24%' }}>cta.png</div>
                  </div>
                  <div className={styles.trackLane}>
                    <div className={`${styles.clip} ${styles.clipT}`} style={{ left: '4%',  width: '24%' }}>READY?</div>
                    <div className={`${styles.clip} ${styles.clipT}`} style={{ left: '34%', width: '34%' }}>47% FASTER</div>
                    <div className={`${styles.clip} ${styles.clipT}`} style={{ left: '72%', width: '26%' }}>GET YOURS</div>
                  </div>
                  <div className={styles.trackLane}><div className={`${styles.clip} ${styles.clipV}`} style={{ left: '2%', width: '96%' }}>voiceover · 22 s · confident</div></div>
                  <div className={styles.trackLane}><div className={`${styles.clip} ${styles.clipM}`} style={{ left: '2%', width: '96%' }}>music · synth-pulse · -18 dB</div></div>
                  <div className={styles.playhead} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Storyboard ───────────────────────────────────────── */}
      <section className={styles.storyboard} id="how">
        <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal style={{ padding: '40px 32px 0' }}>
          <div className={styles.eyebrow}>Storyboard</div>
          <h2 className={styles.sectionTitle}>Four frames. Ten seconds.</h2>
        </div>
        <div className={`${styles.sbGrid} ${styles.reveal}`} data-reveal>
          {SB_STEPS.map((s) => (
            <div key={s.num} className={styles.sbStep}>
              <div className={styles.sbNum}>{s.num}</div>
              <div className={styles.sbFrame}>{s.icon}</div>
              <h4>{s.label}</h4>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonial ──────────────────────────────────────── */}
      <section className={`${styles.quoteSection} ${styles.reveal}`} data-reveal>
        <div className={styles.eyebrow} style={{ justifyContent: 'center', display: 'inline-flex' }}>Testimonial</div>
        <p className={styles.bigQuote}>
          "We shipped <span className={styles.redWord}>47 creative variants</span> before lunch.
          The same work took our agency six weeks."
        </p>
        <div className={styles.quoteAttr}>
          <span className={styles.avatar} />
          <span><b>Maya Okafor</b> · Head of Growth, Luma Goods</span>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section className={styles.section} id="pricing">
        <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
          <div className={styles.eyebrow}>Pricing</div>
          <h2 className={styles.sectionTitle}>Pay for what you ship.</h2>
          <p className={styles.sectionSub}>Simple monthly plans. Cancel anytime. No surprises.</p>
        </div>
        <div className={styles.priceGrid}>
          {PRICING.map((p) => (
            <div key={p.name} className={`${styles.priceCard} ${p.featured ? styles.priceCardFeatured : ''} ${styles.reveal}`} data-reveal>
              <div className={styles.priceName}>{p.name}</div>
              <div className={styles.priceNum}>{p.price}<small>/mo</small></div>
              <p className={styles.priceDesc}>{p.desc}</p>
              <ul className={styles.priceList}>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <a className={`${styles.btn} ${p.featured ? styles.btnPrimary : styles.btnOutline} ${styles.btnFullWidth}`} href="#">{p.cta}</a>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className={`${styles.cta} ${styles.reveal}`} data-reveal>
        <h2>Your next ad is one <span className={styles.redWord}>URL</span> away.</h2>
        <p>No credit card. 5 free ads every month. Upgrade when you're shipping.</p>
        <a className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`} href="#hero-form">
          Start for free <Icon d={['M5 12h14', 'm12 5 7 7-7 7']} size={18} />
        </a>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerCol}>
          <div className={styles.logo} style={{ marginBottom: 8 }}>
            <div className={styles.logoMark} /> Ad Studio
          </div>
          <p style={{ color: 'var(--fg3)', fontSize: 13, maxWidth: 260 }}>
            The fastest path from URL to on-air ad. Built for creators who ship.
          </p>
        </div>
        <div className={styles.footerCol}>
          <h5>Product</h5>
          {['Features','Pricing','Gallery','Changelog'].map((l) => <a key={l} href="#">{l}</a>)}
        </div>
        <div className={styles.footerCol}>
          <h5>Company</h5>
          {['About','Careers','Press','Contact'].map((l) => <a key={l} href="#">{l}</a>)}
        </div>
        <div className={styles.footerCol}>
          <h5>Legal</h5>
          {['Privacy','Terms','DMCA'].map((l) => <a key={l} href="#">{l}</a>)}
        </div>
      </footer>
      <div className={styles.copyright}>© 2026 Ad Studio Inc. · Built for creators who ship</div>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface PipeNode { icon: React.ReactNode; label: string; sub: string; highlight?: boolean; }
const PipelineRow: React.FC<{ nodes: (PipeNode | null)[] }> = ({ nodes }) => (
  <div className={styles.pipeRow}>
    {nodes.map((n, i) =>
      n === null ? <div key={i} className={styles.pipeArrow} /> :
      <div key={i} className={`${styles.pipeNode} ${n.highlight ? styles.pipeNodeShipped : ''}`}>
        <div className={`${styles.pico} ${n.highlight ? styles.picoShipped : ''}`}>{n.icon}</div>
        <h4>{n.label}</h4>
        <p>{n.sub}</p>
      </div>
    )}
  </div>
);

// ── Static content ────────────────────────────────────────────────────────────

const FEATURES = [
  { num: '01', title: 'Real crawling',        icon: <Icon d={['M11 11m-7 0a7 7 0 1 0 14 0 7 7 0 1 0-14 0','m21 21-4.35-4.35']} />, desc: 'Puppeteer renders your URL like a real browser and pulls logos, hero images, brand colors, copy, and contact info.' },
  { num: '02', title: 'AI concept',           icon: <Icon d={['M12 2v4','M12 18v4','m4.93 4.93 2.83 2.83','m16.24 16.24 2.83 2.83','M2 12h4','M18 12h4','m4.93 19.07 2.83-2.83','m16.24 7.76 2.83-2.83']} />, desc: 'A 30-second script, voiceover cues, and a three-act structure tuned to your brand voice - generated in seconds.' },
  { num: '03', title: 'Canvas preview',       icon: <Icon d={['M2 6h14v12H2z','m22 8-6 4 6 4V8Z']} />,                           desc: 'Watch the ad render live on canvas. Scrub, pause, fullscreen - no export needed to review a cut.' },
  { num: '04', title: 'Timeline editor',      icon: <Icon d={['M3 4h18v16H3z','M3 10h18','M9 4v16']} />,                         desc: 'Five tracks - images, text, voiceover, music, overlays. Drag, trim, mix, mute. 30 levels of undo.' },
  { num: '05', title: 'Multi-format export',  icon: <Icon d={['M7 2h10l4 4v16H3V2z','M17 2v4h4','M8 14h8','M8 10h4']} />,      desc: '1920×1080 CTV. 1080×1920 mobile. 1080×1080 social. MP4 or WebM. 30 or 60 fps. One click.' },
  { num: '06', title: 'Regenerate, any tone', icon: <Icon d={['M12 2a10 10 0 1 0 10 10','M22 2 12 12','M16 2h6v6']} />,         desc: 'Professional, energetic, warm, luxury - swap the voiceover and visual pace without touching your edits.' },
];

const SB_STEPS = [
  { num: 'FRAME 01', label: 'Paste',  desc: 'Any public business URL. SaaS, DTC, B2B, local.',       icon: <Icon d={['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z','M2 12h20','M12 2a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18']} size={40} /> },
  { num: 'FRAME 02', label: 'Crawl',  desc: 'Images, colors, copy, and contact info - extracted.',   icon: <Icon d={['M3 3h18v18H3z','M3 9h18','M9 21V9']} size={40} /> },
  { num: 'FRAME 03', label: 'Edit',   desc: 'Drag clips on the timeline. Or ship the draft as-is.',  icon: <Icon d={['M4 4h16v16H4z','M4 10h16','M10 4v16']} size={40} /> },
  { num: 'FRAME 04', label: 'Export', desc: '16:9, 9:16, 1:1. MP4 or WebM. 30 or 60 fps.',          icon: <Icon d={['M12 3v12','M7 10l5 5 5-5','M5 21h14']} size={40} /> },
];

const PRICING = [
  { name: 'Starter', price: '$0',   featured: false, desc: 'Kick the tires. Ship your first ad today.',             cta: 'Get started',         features: ['5 ads per month','All 3 export aspects','720p output','Community support'] },
  { name: 'Studio',  price: '$49',  featured: true,  desc: 'For creators and solo marketers shipping weekly.',      cta: 'Start 14-day trial',  features: ['50 ads per month','4K output, 60 fps','Brand kit & custom fonts','Priority AI queue','Remove Ad Studio watermark'] },
  { name: 'Agency',  price: '$199', featured: false, desc: 'For teams running campaigns across many clients.',      cta: 'Contact sales',       features: ['Unlimited ads','Team workspaces & roles','White-label exports','API & webhooks','Dedicated support'] },
];
