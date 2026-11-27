import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../data/seed.json';
import { datasetSchema, type Unit } from '../lib/schema';
import {
  buildCodeMap,
  CODE_MAP_ROW_GAP,
  CODE_MAP_ROW_HEIGHT,
  CODE_MAP_SHADES,
  CODE_MAP_WIDTH,
  findFunctionAtPoint,
  shadeIndex,
} from '../lib/code-map';

const data = datasetSchema.parse(seed);

function makeUnit(name: string, functions: Unit['functions']): Unit {
  const total_code = functions.reduce((s, f) => s + f.size, 0);
  const matched_code = functions.filter(f => f.similarity >= 100).reduce((s, f) => s + f.size, 0);
  const matched_functions = functions.filter(f => f.similarity >= 100).length;
  return {
    name,
    category: 'game',
    complete: total_code > 0 && matched_code === total_code,
    measures: {
      total_code,
      matched_code,
      complete_code: 0,
      total_data: 0,
      matched_data: 0,
      total_functions: functions.length,
      matched_functions,
      total_units: 1,
      complete_units: 0,
    },
    functions,
  };
}

function sumPathWidths(d: string): number {
  let sum = 0;
  for (const match of d.matchAll(/h([0-9.]+)v/g)) {
    sum += Number(match[1]);
  }
  return sum;
}

test('shadeIndex places nonzero similarities below 0.01% in Under 90%, not 0%', () => {
  assert.equal(shadeIndex(100), 0);
  assert.equal(shadeIndex(99.99), 1);
  assert.equal(shadeIndex(90), 1);
  assert.equal(shadeIndex(89.99), 2);
  assert.equal(shadeIndex(0.004), 2);
  assert.equal(shadeIndex(0), 3);
});

test('buildCodeMap merges adjacent same-shade functions and drastically reduces SVG geometry on seed', () => {
  const layout = buildCodeMap(data.latest.units);
  const totalFunctions = data.latest.units.reduce((s, u) => s + u.functions.length, 0);
  const totalSubpaths = layout.shadePaths.reduce((s, p) => s + (p.d.match(/z/g)?.length ?? 0), 0);

  assert.ok(layout.shadePaths.length > 0 && layout.shadePaths.length <= CODE_MAP_SHADES.length);
  assert.ok(totalSubpaths < totalFunctions / 3, `expected merged subpaths (${totalSubpaths}) << functions (${totalFunctions})`);

  const expectedUnits = data.latest.units.filter(u => u.functions.some(f => f.size > 0)).length;
  assert.equal(layout.units.length, expectedUnits);

  const shadeWidth = layout.shadePaths.reduce((s, p) => s + sumPathWidths(p.d), 0);
  const spanWidth = layout.units.reduce((s, u) => s + u.spans.reduce((a, sp) => a + sp.width, 0), 0);
  const expectedWidth = layout.totalBytes * layout.scale;
  assert.ok(Math.abs(shadeWidth - expectedWidth) < 2, `shade width ${shadeWidth} vs expected ${expectedWidth}`);
  assert.ok(Math.abs(spanWidth - expectedWidth) < 2, `span width ${spanWidth} vs expected ${expectedWidth}`);
});

test('buildCodeMap merges across same-shade neighbours while keeping unit dividers and row wraps accurate', () => {
  const units = [
    makeUnit('a/first', [
      { name: 'f1', size: 100, similarity: 100 },
      { name: 'f2', size: 100, similarity: 100 },
    ]),
    makeUnit('a/second', [
      { name: 'f3', size: 200, similarity: 100 },
      { name: 'f4', size: 1200, similarity: 50 },
    ]),
  ];
  const layout = buildCodeMap(units);

  // Total 1600 bytes -> 100 bytes/row -> f1+f2 fill row 0 (1 subpath), f3 fills rows 1-2 (2 subpaths).
  const green = layout.shadePaths.find(p => p.label === '100%');
  assert.ok(green);
  assert.equal(green.d.match(/z/g)?.length, 4);
  assert.equal(layout.units.length, 2);
  // first occupies rows 0 and 1 (200 bytes at 100 B/row)
  assert.deepEqual(layout.units[0].spans.map(s => s.row), [0, 1]);
  assert.equal(layout.units[0].spans[0].x1, 0);
  assert.equal(layout.units[0].spans[0].x2, CODE_MAP_WIDTH);
  // second starts at row 2 x=0, so no mid-row divider is needed on row 2
  assert.equal(layout.units[1].spans[0].row, 2);
  assert.equal(layout.dividersPath, '');
});

test('buildCodeMap skips empty and zero-size units safely', () => {
  const empty = buildCodeMap([]);
  assert.equal(empty.totalBytes, 0);
  assert.deepEqual(empty.shadePaths, []);
  assert.deepEqual(empty.units, []);
  assert.equal(empty.dividersPath, '');

  const zeroOnly = buildCodeMap([
    makeUnit('data/only', []),
    makeUnit('zero/funcs', [{ name: 'z', size: 0, similarity: 100 }]),
  ]);
  assert.equal(zeroOnly.totalBytes, 0);
  assert.deepEqual(zeroOnly.units, []);
});

test('findFunctionAtPoint maps SVG coordinates to the exact function including wrapped rows and gaps', () => {
  const u = makeUnit('game/player', [
    { name: 'init', size: 60, similarity: 100 },
    { name: 'update', size: 100, similarity: 50 },
  ]);
  // 160 bytes across 16 rows -> 10 bytes/row, scale = 100 px/byte.
  // init: bytes 0..59 (rows 0..5); update: bytes 60..159 (rows 6..15).
  const layout = buildCodeMap([u]);
  const mapUnit = layout.units[0];
  const stride = CODE_MAP_ROW_HEIGHT + CODE_MAP_ROW_GAP;

  assert.equal(findFunctionAtPoint(u, mapUnit, layout, 50, 5)?.name, 'init');
  assert.equal(findFunctionAtPoint(u, mapUnit, layout, 950, 5 * stride + 5)?.name, 'init');
  assert.equal(findFunctionAtPoint(u, mapUnit, layout, 50, 6 * stride + 5)?.name, 'update');
  assert.equal(findFunctionAtPoint(u, mapUnit, layout, CODE_MAP_WIDTH, 15 * stride + 10)?.name, 'update');

  // Inside vertical gap between row 0 and row 1
  assert.equal(findFunctionAtPoint(u, mapUnit, layout, 50, CODE_MAP_ROW_HEIGHT + 2), null);
  // Out of vertical bounds
  assert.equal(findFunctionAtPoint(u, mapUnit, layout, 50, -1), null);
});
