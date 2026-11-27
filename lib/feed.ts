import { datasetSchema, type Feed } from './schema';

export const REFRESH_INTERVAL_MS = 60_000;
export const REFRESH_WARNING = 'Couldn’t check for newer stats. Showing the last ones loaded.';

export function parseFeedPayload(payload: unknown): Feed {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid feed payload');
  const record = payload as Record<string, unknown>;
  const data = datasetSchema.parse(record.data);
  const source: Feed['source'] = record.source === 'published' ? 'published' : 'bundled';
  const warning = typeof record.warning === 'string' ? record.warning : null;
  return { data, source, warning };
}

// A transient upstream failure should not replace good published data with an old seed.
export function mergeFeed(previous: Feed, next: Feed): Feed {
  if (next.source !== 'published' && previous.source === 'published') {
    return { ...previous, warning: REFRESH_WARNING };
  }
  return next;
}

export function retainFeedOnError(previous: Feed): Feed {
  return { ...previous, warning: REFRESH_WARNING };
}
