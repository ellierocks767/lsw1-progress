'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { mergeFeed, parseFeedPayload, REFRESH_INTERVAL_MS, retainFeedOnError } from '@/lib/feed';
import type { Feed } from '@/lib/schema';
const Context = createContext<Feed | null>(null);
export function FeedProvider({ initial, children }: { initial: Feed; children: React.ReactNode }) {
  const [feed, setFeed] = useState(initial);
  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let lastChecked = Date.now();
    const controller = new AbortController();
    async function refresh() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      lastChecked = Date.now();
      try {
        const response = await fetch('/api/progress', { signal: controller.signal });
        if (!response.ok) throw new Error('Refresh failed');
        const next = parseFeedPayload(await response.json());
        if (!alive) return;
        setFeed(previous => mergeFeed(previous, next));
      } catch {
        if (alive && !controller.signal.aborted) setFeed(retainFeedOnError);
      } finally {
        inFlight = false;
      }
    }
    function handleVisibilityChange() {
      if (!document.hidden && Date.now() - lastChecked >= REFRESH_INTERVAL_MS) {
        void refresh();
      }
    }
    const interval = setInterval(() => { void refresh(); }, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  return <Context value={feed}>{children}</Context>;
}
export function useFeed() {
  const feed = useContext(Context);
  if (!feed) throw new Error('FeedProvider is missing');
  return feed;
}
