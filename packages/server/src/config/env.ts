/**
 * Centralised environment config.
 *
 * WHY a typed config module instead of reading process.env inline:
 * - One place to catch missing vars at startup, not at runtime in a hot path
 * - TypeScript knows the exact shape — no repeated optionality guards
 * - Swap-ready: replace this module with a secrets manager adapter without
 *   touching any service file
 */

import { config as loadDotenv } from 'dotenv';
import path from 'path';

// Resolve .env relative to monorepo root: packages/server/src/config → ../../../../
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

type NodeEnv = 'development' | 'production' | 'test';
type StorageProvider = 'local' | 'oracle';

export interface EnvConfig {
  nodeEnv: NodeEnv;
  port: number;
  clientOrigin: string;
  storage: {
    provider: StorageProvider;
    localPath: string;
  };
  oracle: {
    objectStorageNamespace: string | null;
    objectStorageBucket: string | null;
    region: string | null;
    tenancyOcid: string | null;
    userOcid: string | null;
    fingerprint: string | null;
    privateKeyPath: string | null;
  };
  puppeteer: {
    executablePath: string | null;
    timeoutMs: number;
  };
  features: {
    realAi: boolean;
    ffmpegExport: boolean;
  };
  ai: {
    openaiApiKey: string | null;
    elevenLabsApiKey: string | null;
    elevenLabsVoiceId: string;
    falApiKey: string | null;
    creatomateApiKey: string | null;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function optionalEnv(key: string, fallback: string): string;
function optionalEnv(key: string): string | null;
function optionalEnv(key: string, fallback?: string): string | null {
  return process.env[key] ?? fallback ?? null;
}

function parseIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable "${key}" must be an integer, got: "${raw}"`);
  }
  return parsed;
}

function parseBoolEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true';
}

function parseNodeEnv(): NodeEnv {
  const raw = process.env['NODE_ENV'] ?? 'development';
  if (raw === 'production' || raw === 'test') return raw;
  return 'development';
}

function parseStorageProvider(): StorageProvider {
  const raw = process.env['STORAGE_PROVIDER'] ?? 'local';
  if (raw === 'oracle') return 'oracle';
  return 'local';
}

// ── Config object (built once at import time) ─────────────────────────────

export const env: EnvConfig = {
  nodeEnv: parseNodeEnv(),
  port: parseIntEnv('PORT', 3001),
  clientOrigin: optionalEnv('CLIENT_ORIGIN', 'http://localhost:5173'),

  storage: {
    provider: parseStorageProvider(),
    localPath: optionalEnv('LOCAL_STORAGE_PATH', './storage'),
  },

  oracle: {
    objectStorageNamespace: optionalEnv('ORACLE_OBJECT_STORAGE_NAMESPACE'),
    objectStorageBucket: optionalEnv('ORACLE_OBJECT_STORAGE_BUCKET'),
    region: optionalEnv('ORACLE_OBJECT_STORAGE_REGION'),
    tenancyOcid: optionalEnv('ORACLE_TENANCY_OCID'),
    userOcid: optionalEnv('ORACLE_USER_OCID'),
    fingerprint: optionalEnv('ORACLE_FINGERPRINT'),
    privateKeyPath: optionalEnv('ORACLE_PRIVATE_KEY_PATH'),
  },

  puppeteer: {
    executablePath: optionalEnv('PUPPETEER_EXECUTABLE_PATH') ?? null,
    timeoutMs: parseIntEnv('PUPPETEER_TIMEOUT_MS', 30_000),
  },

  features: {
    realAi: parseBoolEnv('FEATURE_REAL_AI', false),
    ffmpegExport: parseBoolEnv('FEATURE_FFMPEG_EXPORT', false),
  },

  ai: {
    openaiApiKey: optionalEnv('OPENAI_API_KEY') ?? null,
    elevenLabsApiKey: optionalEnv('ELEVENLABS_API_KEY') ?? null,
    elevenLabsVoiceId: optionalEnv('ELEVENLABS_VOICE_ID', 'EXAVITQu4vr4xnSDxMaL'),
    falApiKey: optionalEnv('FAL_API_KEY') ?? null,
    creatomateApiKey: optionalEnv('CREATOMATE_API_KEY') ?? null,
  },
};
