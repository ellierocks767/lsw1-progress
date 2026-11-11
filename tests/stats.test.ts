import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../data/seed.json';
import { datasetSchema } from '../lib/schema';
import { categories, change, delta, percent, unitHref } from '../lib/stats';
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
