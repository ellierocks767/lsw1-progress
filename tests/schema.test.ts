import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../data/seed.json';
import { datasetSchema } from '../lib/schema';

const ok = (d: unknown) => datasetSchema.safeParse(d).success;
const withLatest = (patch: object) => ({ ...seed, latest: { ...seed.latest, ...patch } });

test('measures that exceed their totals are rejected', () => {
  const m = seed.latest.measures;
  assert.equal(ok(withLatest({ measures: { ...m, matched_code: m.total_code + 1 } })), false);
  assert.equal(ok(withLatest({ measures: { ...m, complete_code: m.total_code + 1 } })), false);
  assert.equal(ok(withLatest({ measures: { ...m, matched_functions: m.total_functions + 1 } })), false);
  assert.equal(ok(withLatest({ measures: { ...m, complete_units: m.total_units + 1 } })), false);
  assert.equal(ok(withLatest({ measures: { ...m, total_code: 1.5 } })), false);
});

test('revisions must be full lowercase SHA-1 hashes or null', () => {
  assert.equal(ok(withLatest({ revision: null })), true);
  assert.equal(ok(withLatest({ revision: 'abc123' })), false);
  assert.equal(ok(withLatest({ revision: 'A'.repeat(40) })), false);
});

test('build links must be GitHub Actions run URLs over HTTPS', () => {
  assert.equal(ok(withLatest({ build_url: 'https://example.com/ellierocks767/x/actions/runs/1' })), false);
  assert.equal(ok(withLatest({ build_url: 'http://github.com/a/b/actions/runs/1' })), false);
  assert.equal(ok(withLatest({ build_url: 'https://github.com/a/b/actions/runs/1' })), true);
});

test('function similarity outside 0-100 is rejected', () => {
  const [unit, ...rest] = seed.latest.units;
  const fn = unit.functions[0] ?? { name: 'f', size: 4, similarity: 50 };
  const bad = (similarity: number) =>
    ok(withLatest({ units: [{ ...unit, functions: [{ ...fn, similarity }, ...unit.functions.slice(1)] }, ...rest] }));
  assert.equal(bad(100.01), false);
  assert.equal(bad(-0.01), false);
});

test('timestamps must be ISO datetimes', () => {
  assert.equal(ok(withLatest({ generated_at: 'yesterday' })), false);
});
