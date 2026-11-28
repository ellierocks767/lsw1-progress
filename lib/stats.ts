import type { Dataset, Measures, Unit } from './schema';
export const format = (n: number) => n.toLocaleString('en-US');
export const kib = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
export const percent = (n: number, total: number) => total ? 100 * n / total : 0;
// Rounding must not claim 100% for something that is not complete.
export function formatPercent(value: number, digits = 1) {
  const rounded = value.toFixed(digits);
  if (value < 100 && Number(rounded) >= 100) return '<100%';
  // Likewise, real progress must not read as exactly zero.
  if (value > 0 && Number(rounded) === 0) return `<${(10 ** -digits).toFixed(digits)}%`;
  return `${rounded}%`;
}
// Screen-reader value: truncated (not rounded) so incomplete code never reads as 100.
export const ariaPercent = (value: number) => Math.min(100, Math.floor(value * 100) / 100);
// Units without code (data-only) have no coverage to state; say so rather than 0.0%.
export const codeCoverage = (m: Pick<Measures, 'matched_code' | 'total_code'>, digits = 1) =>
  m.total_code === 0 ? 'No code' : formatPercent(percent(m.matched_code, m.total_code), digits);
export const formatSimilarity = (score: number) => formatPercent(score, 2);
export const date = (s: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(s)) + ' UTC';
const categoryNames: Record<string, string> = { game: 'Game and Nu2', sdk: 'Dolphin SDK', runtime: 'SN runtime', other: 'Unclassified code' };
// Own-property lookup so a category such as "constructor" is not resolved through Object.prototype.
export const categoryName = (name: string) => Object.hasOwn(categoryNames, name) ? categoryNames[name] : name;
export const unitHref = (name: string) => '/units/' + name.split('/').map(encodeURIComponent).join('/');
export const sourceHref = (unit: string, revision: string | null) => `https://github.com/ellierocks767/lsw1-decomp/tree/${revision || 'main'}/src/${unit.split('/').map(encodeURIComponent).join('/')}.c`;
export function categories(units: Unit[]) {
  const groups = new Map<string, { total: number; matched: number; functions: number; done: number }>();
  for (const unit of units) {
    const g = groups.get(unit.category) || { total: 0, matched: 0, functions: 0, done: 0 };
    g.total += unit.measures.total_code; g.matched += unit.measures.matched_code;
    g.functions += unit.measures.total_functions; g.done += unit.measures.matched_functions;
    groups.set(unit.category, g);
  }
  return [...groups].sort((a, b) => b[1].total - a[1].total);
}
// A changed denominator can make percentages move without a matching gain.
// The report before the latest one. History normally ends with the latest report, but a feed may omit it
// or carry later points, so find it by id rather than assuming it is last.
export function previousReport(history: Dataset['history'], latestId?: string) {
  const index = latestId === undefined ? history.length - 1 : history.findIndex(p => p.id === latestId);
  if (index === -1) return history.at(-1);
  return history[index - 1];
}
export function delta(history: Dataset['history'], current: Measures, latestId?: string) {
  const prior = previousReport(history, latestId);
  if (!prior || prior.measures.total_code !== current.total_code || prior.measures.total_functions !== current.total_functions) return null;
  return { bytes: current.matched_code - prior.measures.matched_code,
    functions: current.matched_functions - prior.measures.matched_functions, since: prior.report_at };
}
// Labels for the "since previous report" card. One report is not a zero gain.
export function change(history: Dataset['history'], current: Measures, latestId?: string) {
  if (!previousReport(history, latestId)) return { value: 'First report', detail: 'Changes appear after the next build' };
  const d = delta(history, current, latestId);
  if (!d) return { value: 'Not comparable', detail: 'Totals changed since the last report' };
  const sign = (n: number) => (n > 0 ? '+' : '') + format(n);
  return { value: `${sign(d.bytes)} B`, detail: `${sign(d.functions)} functions since ${date(d.since)}` };
}
// A verdict absent from the sweep is unavailable, not zero.
export const verdictCount = (verdicts: Record<string, number>, key: string) =>
  Object.hasOwn(verdicts, key) ? format(verdicts[key]) : 'Not reported';
// Unit table ordering. Units without code have no coverage, so they follow every unit that has some
// rather than tying with genuine 0% units. Ties fall back to name so the order is deterministic.
export type UnitSort = 'remaining' | 'functions' | 'coverage' | 'name';
export function compareUnits(sort: UnitSort | string, a: Unit, b: Unit) {
  const am = a.measures, bm = b.measures;
  const byName = a.name.localeCompare(b.name);
  if (sort === 'name') return byName;
  if (sort === 'functions') return (bm.total_functions - bm.matched_functions) - (am.total_functions - am.matched_functions) || byName;
  if (sort === 'coverage') {
    if (!am.total_code || !bm.total_code) return (am.total_code ? 0 : 1) - (bm.total_code ? 0 : 1) || byName;
    return bm.matched_code / bm.total_code - am.matched_code / am.total_code || byName;
  }
  return (bm.total_code - bm.matched_code) - (am.total_code - am.matched_code) || byName;
}
// The candidates page says rows are ranked by size × similarity, so enforce that order here rather than
// trusting the feed. Ties fall back to unit and function name so the order is deterministic.
export type Candidate = NonNullable<Dataset['latest']['candidates']>['rows'][number];
export function compareCandidates(a: Candidate, b: Candidate) {
  return b.size * b.similarity - a.size * a.similarity || a.unit.localeCompare(b.unit) || a.name.localeCompare(b.name);
}
