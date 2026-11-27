import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../data/seed.json';
import { datasetSchema } from '../lib/schema';
import { categories, change, delta, formatSimilarity, percent, unitHref } from '../lib/stats';
const data = datasetSchema.parse(seed);
test('seed matches the public schema and category totals reconcile', () => {
  const groups = categories(data.latest.units);
  assert.equal(groups.reduce((s,[,g])=>s+g.total,0),data.latest.measures.total_code);
  assert.equal(groups.reduce((s,[,g])=>s+g.matched,0),data.latest.measures.matched_code);
});
test('a changed denominator suppresses misleading progress deltas', () => {
  const current = data.latest.measures;
  const first = {...data.history[0],id:'first',measures:{...current,matched_code:current.matched_code-12}};
  const second = {...data.history[0],id:'second',measures:current};
  assert.equal(delta([first,second],current)?.bytes,12);
  assert.equal(delta([{...first,measures:{...first.measures,total_code:current.total_code+4}},second],current),null);
  assert.equal(delta([second],current),null);
});
test('zero totals and unit paths are handled safely', () => {
  assert.equal(percent(0,0),0);
  assert.equal(unitHref('auto/a b/test'),'/units/auto/a%20b/test');
});
test('rounded objdiff similarity preserves the exact-match threshold', () => {
  assert.equal(formatSimilarity(0), '0.00%');
  assert.equal(formatSimilarity(99.9703), '99.97%');
  assert.equal(formatSimilarity(99.999), '<100%');
  assert.equal(formatSimilarity(100), '100.00%');
});
test('malformed and incompatible feeds are rejected', () => {
  assert.equal(datasetSchema.safeParse({...seed,schema_version:2}).success,false);
  assert.equal(datasetSchema.safeParse({...seed,latest:{...seed.latest,measures:{...seed.latest.measures,matched_code:-1}}}).success,false);
});
test('the change card never reports a missing comparison as zero', () => {
  const current = data.latest.measures;
  const point = data.history[0];
  assert.equal(change([point],current).value,'First report');
  const older = {...point,id:'older',measures:{...current,total_code:current.total_code+4}};
  assert.equal(change([older,point],current).value,'Not comparable');
  const gained = {...point,id:'gained',measures:{...current,matched_code:current.matched_code-2048,matched_functions:current.matched_functions-3}};
  assert.equal(change([gained,point],current).value,'+2,048 B');
  assert.match(change([gained,point],current).detail,/^\+3 functions since /);
});

test('the bundled seed lists code in load-address order, so the code map can say so', () => {
  // Auto-named functions carry their address; named ones are skipped.
  const addresses = data.latest.units.flatMap(u => u.functions.map(f => /^fn_([0-9A-F]{8})$/i.exec(f.name)?.[1])).filter(Boolean).map(a => parseInt(a!, 16));
  assert.ok(addresses.length > 1000);
  assert.ok(addresses.every((a, i) => i === 0 || a > addresses[i - 1]));
});

test('seed unit rows reconcile with the published totals', () => {
  const { units, measures } = data.latest;
  const sum = (pick: (u: (typeof units)[number]) => number) => units.reduce((s, u) => s + pick(u), 0);
  assert.equal(sum(u => u.measures.total_code), measures.total_code);
  assert.equal(sum(u => u.measures.matched_code), measures.matched_code);
  assert.equal(sum(u => u.measures.complete_code), measures.complete_code);
  assert.equal(sum(u => u.measures.total_functions), measures.total_functions);
  assert.equal(sum(u => u.measures.matched_functions), measures.matched_functions);
  assert.equal(sum(u => u.measures.matched_data), measures.matched_data);
  assert.equal(sum(u => Number(u.complete)), measures.complete_units);
  // Units without code or data are not listed, so the row count may be lower.
  assert.ok(units.length <= measures.total_units);
});

test('each unit lists exactly the functions its measures count', () => {
  for (const u of data.latest.units) {
    assert.equal(u.functions.length, u.measures.total_functions, u.name);
    assert.equal(u.functions.reduce((s, f) => s + f.size, 0) <= u.measures.total_code, true, u.name);
    assert.equal(u.functions.filter(f => f.similarity >= 100).length, u.measures.matched_functions, u.name);
  }
});

test('history ends at the latest report and has one point per revision', () => {
  const last = data.history.at(-1)!;
  assert.equal(last.id, data.latest.id);
  assert.deepEqual(last.measures, data.latest.measures);
  const revisions = data.history.map(p => p.revision).filter(Boolean);
  assert.equal(new Set(revisions).size, revisions.length);
});

test('display helpers format counts, sizes, dates and links predictably', async () => {
  const { format, kib, date, categoryName, sourceHref } = await import('../lib/stats');
  assert.equal(format(1234567), '1,234,567');
  assert.equal(kib(1536), '1.5 KiB');
  assert.equal(kib(0), '0.0 KiB');
  assert.equal(date('2026-01-02T03:04:00+02:00'), 'Jan 2, 2026, 1:04 AM UTC');
  assert.equal(categoryName('sdk'), 'Dolphin SDK');
  assert.equal(categoryName('custom'), 'custom');
  const sha = 'a'.repeat(40);
  assert.equal(sourceHref('auto/a b/test', sha), `https://github.com/ellierocks767/lsw1-decomp/tree/${sha}/src/auto/a%20b/test.c`);
  // An unrecorded revision falls back to the branch rather than inventing a commit.
  assert.match(sourceHref('x', null), /\/tree\/main\/src\/x\.c$/);
});

test('every seed unit category has a readable label', async () => {
  const { categoryName } = await import('../lib/stats');
  for (const u of data.latest.units) assert.notEqual(categoryName(u.category), u.category, u.name);
});

test('category labels ignore inherited object properties', async () => {
  const { categoryName } = await import('../lib/stats');
  for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(categoryName(name), name);
});

test('rounded percentages never show 100% for incomplete code', async () => {
  const { formatPercent } = await import('../lib/stats');
  assert.equal(formatPercent(99.96, 1), '<100%');
  assert.equal(formatPercent(99.996, 2), '<100%');
  assert.equal(formatPercent(99.94, 1), '99.9%');
  assert.equal(formatPercent(100, 1), '100.0%');
  assert.equal(formatPercent(0, 2), '0.00%');
});

test('rounded percentages never show 0% for nonzero progress', async () => {
  const { formatPercent } = await import('../lib/stats');
  assert.equal(formatPercent(0.04, 1), '<0.1%');
  assert.equal(formatPercent(0.004, 2), '<0.01%');
  assert.equal(formatPercent(0.05, 1), '0.1%');
  assert.equal(formatPercent(0, 1), '0.0%');
});

test('the progress bar value for assistive tech never rounds up to 100', async () => {
  const { ariaPercent } = await import('../lib/stats');
  assert.equal(ariaPercent(99.996), 99.99);
  assert.equal(ariaPercent(12.345), 12.34);
  assert.equal(ariaPercent(0), 0);
  assert.equal(ariaPercent(100), 100);
});

test('code coverage labels say "No code" instead of 0.0% for units without code', async () => {
  const { codeCoverage } = await import('../lib/stats');
  assert.equal(codeCoverage({ matched_code: 0, total_code: 0 }), 'No code');
  assert.equal(codeCoverage({ matched_code: 0, total_code: 100 }), '0.0%');
  assert.equal(codeCoverage({ matched_code: 1, total_code: 3 }, 2), '33.33%');
  assert.equal(codeCoverage({ matched_code: 99999, total_code: 100000 }), '<100%');
});
