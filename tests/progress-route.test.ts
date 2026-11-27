import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/progress/route';
import seed from '../data/seed.json';

test('polling reuses an unchanged feed and detects report and source changes', async t => {
  let dataset = seed;
  let upstreamOk = true;
  const previousUrl = process.env.PROGRESS_DATA_URL;
  process.env.PROGRESS_DATA_URL = 'https://fixture.invalid/progress.json';
  t.after(() => {
    if (previousUrl === undefined) delete process.env.PROGRESS_DATA_URL;
    else process.env.PROGRESS_DATA_URL = previousUrl;
  });
  t.mock.method(globalThis, 'fetch', async () => upstreamOk
    ? Response.json(dataset)
    : new Response(null, { status: 503 }));

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
  assert.notEqual(updated.headers.get('ETag'), tag);
  assert.equal((await updated.json()).data.latest.generated_at, dataset.latest.generated_at);

  upstreamOk = false;
  const fallback = await poll(tag);
  assert.equal(fallback.status, 200);
  const fallbackTag = fallback.headers.get('ETag');
  assert.ok(fallbackTag && fallbackTag !== tag);
  assert.equal((await fallback.json()).source, 'bundled');

  upstreamOk = true;
  dataset = seed;
  const recovered = await poll(fallbackTag);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.headers.get('ETag'), tag);
});
