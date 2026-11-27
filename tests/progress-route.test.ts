import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/progress/route';
import seed from '../data/seed.json';

test('polling reuses an unchanged feed and detects report and source changes', async t => {
  let dataset = seed;
  const publishedResponse = () => Response.json(dataset);
  let upstreamResponse = publishedResponse;
  const previousUrl = process.env.PROGRESS_DATA_URL;
  process.env.PROGRESS_DATA_URL = 'https://fixture.invalid/progress.json';
  t.after(() => {
    if (previousUrl === undefined) delete process.env.PROGRESS_DATA_URL;
    else process.env.PROGRESS_DATA_URL = previousUrl;
  });
  t.mock.method(globalThis, 'fetch', async () => upstreamResponse());

  function poll(tag?: string) {
    return GET(new Request('http://localhost/api/progress', {
      headers: tag ? { 'If-None-Match': tag } : {},
    }));
  }

  const first = await poll();
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('Cache-Control'), 'private, no-cache');
  assert.equal((await first.json()).source, 'published');
  const tag = first.headers.get('ETag');
  assert.ok(tag);

  const unchanged = await poll(`"older", ${tag}`);
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.headers.get('ETag'), tag);
  assert.equal(unchanged.headers.get('Cache-Control'), 'private, no-cache');
  assert.equal(await unchanged.text(), '');

  dataset = { ...seed, latest: { ...seed.latest, generated_at: '2026-11-26T00:00:00Z' } };
  const updated = await poll(tag);
  assert.equal(updated.status, 200);
  const updatedTag = updated.headers.get('ETag');
  assert.ok(updatedTag && updatedTag !== tag);
  assert.equal((await updated.json()).data.latest.generated_at, dataset.latest.generated_at);

  upstreamResponse = () => new Response(null, { status: 503 });
  const fallback = await poll(updatedTag);
  assert.equal(fallback.status, 200);
  const fallbackTag = fallback.headers.get('ETag');
  assert.ok(fallbackTag && fallbackTag !== updatedTag);
  assert.equal((await fallback.json()).source, 'bundled');

  const invalidReports = [
    ['unsupported schema version', () => Response.json({ ...dataset, schema_version: 2 })],
    ['impossible matching totals', () => Response.json({
      ...dataset,
      latest: {
        ...dataset.latest,
        measures: { ...dataset.latest.measures, matched_code: dataset.latest.measures.total_code + 1 },
      },
    })],
    ['malformed JSON', () => new Response('{', { headers: { 'Content-Type': 'application/json' } })],
  ] as const;
  for (const [name, respond] of invalidReports) {
    await t.test(`an upstream 200 with ${name} returns the bundled snapshot`, async () => {
      upstreamResponse = respond;
      const rejected = await poll(updatedTag);
      assert.equal(rejected.status, 200);
      assert.equal(rejected.headers.get('ETag'), fallbackTag);
      const feed = await rejected.json();
      assert.equal(feed.source, 'bundled');
      assert.match(feed.warning, /saved snapshot/);
      assert.deepEqual(feed.data, seed);
    });
  }

  upstreamResponse = publishedResponse;
  dataset = seed;
  const recovered = await poll(fallbackTag);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.headers.get('ETag'), tag);
});
