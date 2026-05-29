import type { CrawlJob } from './crawl';
import type { AdProject } from './project';

// ── Crawl API ─────────────────────────────────────────────────────────────

export interface CreateCrawlRequestBody {
  url: string;
}

export interface CreateCrawlResponseBody {
  jobId: string;
  status: CrawlJob['status'];
  message: string;
}

export interface CrawlStatusResponseBody {
  job: CrawlJob;
}

// ── Projects API ──────────────────────────────────────────────────────────

export interface GetProjectResponseBody {
  project: AdProject;
}

export interface UpdateProjectRequestBody {
  name?: string;
  timeline?: AdProject['timeline'];
  voiceoverScript?: string | null;
  exportSettings?: AdProject['exportSettings'];
}

export interface UpdateProjectResponseBody {
  project: AdProject;
}

// ── Error shape ───────────────────────────────────────────────────────────

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Field-level validation errors */
    details?: Record<string, string[]>;
  };
}

// ── WebSocket messages ────────────────────────────────────────────────────

export type WsClientMessageType = 'subscribe' | 'unsubscribe' | 'ping';
export type WsServerMessageType =
  | 'subscribed'
  | 'unsubscribed'
  | 'job_update'
  | 'job_complete'
  | 'job_error'
  | 'pong'
  | 'error';

export interface WsClientMessage {
  type: WsClientMessageType;
  /** Job ID to subscribe/unsubscribe from */
  jobId?: string;
}

export interface WsServerMessage {
  type: WsServerMessageType;
  jobId?: string;
  data?: CrawlJob | { message: string };
  timestamp: number;
}
