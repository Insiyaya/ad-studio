/**
 * Crawl job domain types.
 *
 * WHY separate from project types: crawl jobs are ephemeral pipeline state —
 * they can be discarded once brand assets are extracted and attached to a project.
 * Projects are the durable unit of work.
 */

export type CrawlStatus =
  | 'queued'
  | 'connecting'
  | 'extracting_assets'
  | 'analyzing_brand'
  | 'generating_concept'
  | 'complete'
  | 'failed';

export type CrawlStepStatus = 'pending' | 'processing' | 'complete' | 'error';

export interface CrawlStep {
  status: CrawlStepStatus;
  label: string;
  startedAt: number | null;   // Unix ms
  completedAt: number | null; // Unix ms
  error: string | null;
}

/** All four steps a crawl job progresses through, in order */
export interface CrawlSteps {
  connecting: CrawlStep;
  extracting_assets: CrawlStep;
  analyzing_brand: CrawlStep;
  generating_concept: CrawlStep;
}

export interface ExtractedImage {
  src: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
  /** 0–1 quality heuristic: larger, well-proportioned images score higher */
  qualityScore: number;
  /** True when the image is likely the site logo based on DOM position and size */
  isLikelyLogo: boolean;
}

export interface BrandColors {
  /** Most prominent non-neutral brand color */
  primary: string | null;
  secondary: string | null;
  /** Background color of the primary surface */
  background: string | null;
  /** Primary text color */
  text: string | null;
  /** All extracted colors, ranked by brand-color likelihood (max 8) */
  all: string[];
}

export interface ContactInfo {
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface ExtractedBrandAssets {
  sourceUrl: string;
  pageTitle: string;
  metaDescription: string;
  /** Best guess at the business name (OG site_name → title heuristic) */
  businessName: string;
  tagline: string | null;
  /** Best candidate for the logo image URL */
  logoUrl: string | null;
  faviconUrl: string | null;
  /** Filtered, ranked list of content images — top candidates for the ad */
  images: ExtractedImage[];
  colors: BrandColors;
  contactInfo: ContactInfo;
  /** Open Graph primary image */
  ogImage: string | null;
  keywords: string[];
}

export interface CrawlJob {
  id: string;
  url: string;
  status: CrawlStatus;
  steps: CrawlSteps;
  result: ExtractedBrandAssets | null;
  /** Populated once status reaches 'complete' — the project auto-created from this crawl */
  projectId: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}
