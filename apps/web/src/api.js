// Tiny fetch wrapper + SSE hook for the Re:CodeX API.
//
// Pattern: every consumer page imports `useApiOrFallback(path, mock)`. When
// the API is reachable the hook returns the live data; on network/HTTP
// failure (or while the API is offline during local dev) it transparently
// returns the original mock from `data.js` so the UI keeps rendering.
//
// Remove `.env` `VITE_API_BASE` to force mock-only mode (useful for
// previewing pure design without a backend running).

import { useEffect, useRef, useState } from "react";

const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
export const GUILD_ID = import.meta.env.VITE_GUILD_ID ?? "";

export const API_ENABLED = BASE.length > 0;

export async function api(path, init = {}) {
  if (!API_ENABLED) throw new Error("api_disabled");
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`api ${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** multipart variant — pass a FormData. */
export async function apiUpload(path, formData) {
  if (!API_ENABLED) throw new Error("api_disabled");
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`api ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

/**
 * useApiOrFallback(path, mock) → { data, loading, error, reload }
 *
 * - data starts as `mock` so pages render synchronously
 * - on mount, fetch path; on success replace data, on failure keep mock
 * - reload() refetches without resetting to mock
 */
export function useApiOrFallback(path, mock, deps = []) {
  const [data, setData] = useState(mock);
  const [loading, setLoading] = useState(API_ENABLED);
  const [error, setError] = useState(null);

  const reload = () => {
    if (!API_ENABLED || !path) return Promise.resolve();
    setLoading(true);
    return api(path)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        // keep mock; surface error for debug
        setError(err);
      })
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);

  return { data, loading, error, reload };
}

/**
 * useSSE(path, handlers) — open an EventSource and dispatch events by name.
 * `handlers` is `{ [eventName]: (parsedData) => void }`. Auto-closes on
 * unmount. Returns `{ connected }` so the page can show a status pill.
 */
export function useSSE(path, handlers) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!API_ENABLED || !path) return undefined;
    const url = path.startsWith("http") ? path : `${BASE}${path}`;
    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const wrapped = {};
    for (const name of Object.keys(handlersRef.current ?? {})) {
      wrapped[name] = (e) => {
        try {
          handlersRef.current[name]?.(JSON.parse(e.data));
        } catch {
          /* ignore malformed */
        }
      };
      es.addEventListener(name, wrapped[name]);
    }
    return () => {
      for (const name of Object.keys(wrapped)) {
        es.removeEventListener(name, wrapped[name]);
      }
      es.close();
      setConnected(false);
    };
  }, [path]);

  return { connected };
}
