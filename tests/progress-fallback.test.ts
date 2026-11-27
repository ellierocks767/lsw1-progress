import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getProgress } from '../lib/progress';
import seed from '../data/seed.json';

async function withFeed(t: import('node:test').TestContext, url: string, respond: () => Promise<Response>) {
  const previousUrl = process.env.PROGRESS_DATA_URL;
  process.env.PROGRESS_DATA_URL = url;
  t.after(() => {
    if (previousUrl === undefined) delete process.env.PROGRESS_DATA_URL;
    else process.env.PROGRESS_DATA_URL = previousUrl;
  });
  const fetchMock = t.mock.method(globalThis, 'fetch', respond);
  const feed = await getProgress();
  return { feed, fetched: fetchMock.mock.callCount() };
}

test('a valid published feed is labelled published with no warning', async t => {
  const { feed } = await withFeed(t, 'https://fixture.invalid/p.json', async () => Response.json(seed));
  assert.equal(feed.source, 'published');
  assert.equal(feed.warning, null);
});

test('feeds that cannot be trusted fall back to the bundled snapshot with a warning', async t => {
  const cases: [string, string, () => Promise<Response>][] = [
    ['unknown schema version', 'https://fixture.invalid/p.json', async () => Response.json({ ...seed, schema_version: 2 })],
    ['malformed json', 'https://fixture.invalid/p.json', async () => new Response('<html>', { status: 200 })],
    ['network failure', 'https://fixture.invalid/p.json', async () => { throw new TypeError('fetch failed'); }],
    ['server error', 'https://fixture.invalid/p.json', async () => new Response(null, { status: 500 })],
  ];
  for (const [label, url, respond] of cases) {
    await t.test(label, async sub => {
      const { feed } = await withFeed(sub, url, respond);
      assert.equal(feed.source, 'bundled');
      assert.match(feed.warning ?? '', /saved snapshot/);
    });
  }
});

test('a non-HTTPS feed URL is refused before any request is made', async t => {
  const { feed, fetched } = await withFeed(t, 'http://fixture.invalid/p.json', async () => Response.json(seed));
  assert.equal(fetched, 0);
  assert.equal(feed.source, 'bundled');
});
