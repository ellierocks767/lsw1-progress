'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { datasetSchema, type Feed } from '@/lib/schema';
const Context = createContext<Feed | null>(null);
export function FeedProvider({ initial, children }: { initial: Feed; children: React.ReactNode }) {
  const [feed, setFeed] = useState(initial);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch('/api/progress', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Refresh failed');
        const next = await response.json();
        const data = datasetSchema.parse(next.data);
        if (!alive) return;
        setFeed(previous => {
          // A transient upstream failure should not replace good published data with an old seed.
          if (next.source !== 'published' && previous.source === 'published') {
            return { ...previous, warning: 'Refresh failed. Showing the last published report received.' };
          }
          return { data, source: next.source === 'published' ? 'published' : 'bundled', warning: next.warning };
        });
      } catch {
        if (alive) setFeed(previous => ({ ...previous, warning: 'Refresh failed. Showing the last report received.' }));
      }
    }
    const interval = setInterval(refresh, 60_000);
    return () => { alive = false; controller.abort(); clearInterval(interval); };
  }, []);
  return <Context value={feed}>{children}</Context>;
}
export function useFeed() {
  const feed = useContext(Context);
  if (!feed) throw new Error('FeedProvider is missing');
  return feed;
}
