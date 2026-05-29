/**
 * WebSocket server — real-time crawl job progress.
 *
 * Protocol (client → server):
 *   { type: 'subscribe',   jobId: string }  — start receiving updates for a job
 *   { type: 'unsubscribe', jobId: string }  — stop receiving updates
 *   { type: 'ping' }                        — keepalive
 *
 * Protocol (server → client):
 *   { type: 'subscribed',   jobId, timestamp, data: CrawlJob }
 *   { type: 'job_update',   jobId, timestamp, data: CrawlJob }
 *   { type: 'job_complete', jobId, timestamp, data: CrawlJob }
 *   { type: 'job_error',    jobId, timestamp, data: CrawlJob }
 *   { type: 'pong',         timestamp }
 *   { type: 'error',        timestamp, data: { message: string } }
 *
 * WHY no authentication on the WebSocket: this is a prototype. In production,
 * validate a short-lived token issued by the REST API during job creation
 * before allowing subscriptions.
 */

import type { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../config/logger';
import { jobStore } from './jobStore';
import type { CrawlJob } from '../types/crawl';
import type {
  WsClientMessage,
  WsServerMessage,
  WsServerMessageType,
} from '../types/api';

// Maps each WebSocket connection to the set of job IDs it's subscribed to.
// WeakMap keeps GC pressure low — connections are automatically cleaned up.
const subscriptions = new WeakMap<WebSocket, Set<string>>();

export function initWsServer(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket) => {
    subscriptions.set(ws, new Set());
    logger.debug('WebSocket client connected', { total: wss.clients.size });

    ws.on('message', (raw: Buffer | string) => {
      handleClientMessage(ws, raw);
    });

    ws.on('close', () => {
      subscriptions.delete(ws);
      logger.debug('WebSocket client disconnected', { total: wss.clients.size });
    });

    ws.on('error', (err: Error) => {
      logger.warn('WebSocket client error', { err: err.message });
    });
  });

  // Forward job store events to subscribed clients
  jobStore.onUpdated((job) => broadcastJobEvent('job_update', job, wss));
  jobStore.onComplete((job) => broadcastJobEvent('job_complete', job, wss));
  jobStore.onError((job) => broadcastJobEvent('job_error', job, wss));

  logger.info('WebSocket server initialised');
}

// ── Message handling ───────────────────────────────────────────────────────

function handleClientMessage(ws: WebSocket, raw: Buffer | string): void {
  let message: WsClientMessage;

  try {
    message = JSON.parse(raw.toString()) as WsClientMessage;
  } catch {
    sendToClient(ws, { type: 'error', timestamp: Date.now(), data: { message: 'Invalid JSON' } });
    return;
  }

  switch (message.type) {
    case 'subscribe': {
      const { jobId } = message;
      if (!jobId) {
        sendToClient(ws, {
          type: 'error',
          timestamp: Date.now(),
          data: { message: 'subscribe requires a jobId' },
        });
        return;
      }

      subscriptions.get(ws)?.add(jobId);

      // Send the current job state immediately so the client can render it
      const currentJob = jobStore.get(jobId);
      sendToClient(ws, {
        type: 'subscribed',
        jobId,
        timestamp: Date.now(),
        data: currentJob ?? { message: `Job ${jobId} not found` },
      });
      break;
    }

    case 'unsubscribe': {
      const { jobId } = message;
      if (jobId) {
        subscriptions.get(ws)?.delete(jobId);
      }
      sendToClient(ws, { type: 'unsubscribed', jobId: message.jobId, timestamp: Date.now() });
      break;
    }

    case 'ping': {
      sendToClient(ws, { type: 'pong', timestamp: Date.now() });
      break;
    }

    default: {
      sendToClient(ws, {
        type: 'error',
        timestamp: Date.now(),
        data: { message: `Unknown message type: ${String((message as WsClientMessage).type)}` },
      });
    }
  }
}

// ── Broadcast ──────────────────────────────────────────────────────────────

function broadcastJobEvent(
  type: WsServerMessageType,
  job: CrawlJob,
  wss: WebSocketServer
): void {
  const payload: WsServerMessage = {
    type,
    jobId: job.id,
    timestamp: Date.now(),
    data: job,
  };

  const serialised = JSON.stringify(payload);

  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState !== 1 /* OPEN */) return; // WebSocket.OPEN = 1
    const subs = subscriptions.get(client);
    if (subs?.has(job.id)) {
      client.send(serialised);
    }
  });
}

function sendToClient(ws: WebSocket, message: WsServerMessage): void {
  if (ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(message));
  }
}
