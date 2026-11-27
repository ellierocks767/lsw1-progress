import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../data/seed.json';
import { mergeFeed, parseFeedPayload, REFRESH_WARNING, retainFeedOnError } from '../lib/feed';
import { datasetSchema, type Feed } from '../lib/schema';

const baseData = datasetSchema.parse(seed);
const newerData = datasetSchema.parse({
  ...seed,
  latest: { ...seed.latest, generated_at: '2026-11-26T12:00:00Z' },
});

const publishedFeed: Feed = { data: newerData, source: 'published', warning: null };
const bundledFeed: Feed = {
  data: baseData,
  source: 'bundled',
  warning: 'Live build stats are unavailable. Showing a saved snapshot.',
};

test('parseFeedPayload validates the dataset and normalizes source and warning', () => {
  const published = parseFeedPayload({ data: seed, source: 'published', warning: null });
  assert.equal(published.source, 'published');
  assert.equal(published.warning, null);

  const unknownSource = parseFeedPayload({ data: seed, source: 'unknown', warning: 123 });
  assert.equal(unknownSource.source, 'bundled');
  assert.equal(unknownSource.warning, null);

  assert.throws(() => parseFeedPayload(null));
  assert.throws(() => parseFeedPayload({ data: { ...seed, schema_version: 2 }, source: 'published', warning: null }));
});

test('mergeFeed retains published data when a later refresh falls back to the bundled snapshot', () => {
  const merged = mergeFeed(publishedFeed, bundledFeed);
  assert.equal(merged.source, 'published');
  assert.equal(merged.data, publishedFeed.data);
  assert.equal(merged.warning, REFRESH_WARNING);
});

test('mergeFeed upgrades bundled data and clears stale warnings when published data arrives', () => {
  const upgraded = mergeFeed(bundledFeed, publishedFeed);
  assert.equal(upgraded.source, 'published');
  assert.equal(upgraded.data, publishedFeed.data);
  assert.equal(upgraded.warning, null);

  const warnedPublished = retainFeedOnError(publishedFeed);
  assert.equal(warnedPublished.data, publishedFeed.data);
  assert.equal(warnedPublished.source, 'published');
  assert.equal(warnedPublished.warning, REFRESH_WARNING);

  const recovered = mergeFeed(warnedPublished, publishedFeed);
  assert.equal(recovered.source, 'published');
  assert.equal(recovered.warning, null);
});
