/**
 * Subscribes to real-time crawl job updates over WebSocket.
 *
 * Sends a `subscribe` message when the socket opens, receives `job_update`,
 * `job_complete`, and `job_error` events, and keeps the Zustand store and
 * local state in sync.
 *
 * WHY merge into store AND return local state: the store is the source of
 * truth for the rest of the app (navigation guard, project loading). The
 * local returned value lets the CrawlProgress component avoid subscribing
 * to the full store just to render step status.
 */

import { useState, useCallback } from 'react';
import { useWebSocket, sendWsMessage } from './useWebSocket';
import { useAdStudioStore } from '../lib/store';
import type { CrawlJob, WsServerMessage } from '../types';

interface UseCrawlProgressResult {
  job: CrawlJob | null;
  isConnecting: boolean;
}

export function useCrawlProgress(jobId: string | null): UseCrawlProgressResult {
  const setCrawlJob = useAdStudioStore((s) => s.setCrawlJob);
  const [job, setJob] = useState<CrawlJob | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);

  const handleMessage = useCallback(
    (msg: WsServerMessage) => {
      if (msg.type === 'pong') return;

      if (
        (msg.type === 'subscribed' ||
          msg.type === 'job_update' ||
          msg.type === 'job_complete' ||
          msg.type === 'job_error') &&
        msg.data &&
        'status' in msg.data
      ) {
        const updatedJob = msg.data as CrawlJob;
        setJob(updatedJob);
        setCrawlJob(updatedJob);
        setIsConnecting(false);
      }
    },
    [setCrawlJob]
  );

  const handleOpen = useCallback(
    (ws: WebSocket) => {
      if (jobId) {
        sendWsMessage(ws, { type: 'subscribe', jobId });
      }
      setIsConnecting(false);
    },
    [jobId]
  );

  useWebSocket(jobId !== null, { onMessage: handleMessage, onOpen: handleOpen });

  return { job, isConnecting };
}
