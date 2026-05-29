/**
 * Raw WebSocket connection hook.
 *
 * Maintains a single WebSocket connection per mounted consumer, reconnects
 * on unexpected close (up to MAX_RETRIES times with exponential backoff),
 * and tears down cleanly on unmount.
 *
 * WHY not a library like socket.io: the server uses the bare `ws` library.
 * Adding socket.io client for a handful of message types would be over-engineering.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { WsServerMessage } from '../types';

interface UseWebSocketOptions {
  /** Fired when a parsed message arrives */
  onMessage: (message: WsServerMessage) => void;
  /** Fired when the connection opens - send subscriptions here */
  onOpen?: (ws: WebSocket) => void;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;

export function useWebSocket(
  enabled: boolean,
  options: UseWebSocketOptions
): void {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const unmountedRef = useRef(false);
  // Keep callbacks stable across re-renders without re-triggering the effect
  const onMessageRef = useRef(options.onMessage);
  const onOpenRef = useRef(options.onOpen);
  onMessageRef.current = options.onMessage;
  onOpenRef.current = options.onOpen;

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    // In prod VITE_API_URL is https://...; swap protocol to wss://.
    // In dev it's empty, so fall back to same-origin window.location.
    const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
    let url: string;
    if (apiUrl) {
      url = apiUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws';
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      url = `${protocol}//${window.location.host}/ws`;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      onOpenRef.current?.(ws);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as WsServerMessage;
        onMessageRef.current(msg);
      } catch {
        // Malformed server message - ignore
      }
    };

    ws.onclose = (event) => {
      if (unmountedRef.current) return;
      // 1000 = normal closure, 1001 = going away - don't retry
      if (event.code === 1000 || event.code === 1001) return;
      if (retriesRef.current >= MAX_RETRIES) return;

      const delay = BASE_DELAY_MS * Math.pow(2, retriesRef.current);
      retriesRef.current++;
      setTimeout(connect, delay);
    };
  }, []); // stable - no deps

  useEffect(() => {
    unmountedRef.current = false;

    if (!enabled) return;

    connect();

    return () => {
      unmountedRef.current = true;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [enabled, connect]);
}

/** Sends a typed message if the socket is open */
export function sendWsMessage(ws: WebSocket, message: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
