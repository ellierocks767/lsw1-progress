import type { Dataset, Measures, Unit } from './schema';
export const format = (n: number) => n.toLocaleString('en-US');
export const kib = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
export const percent = (n: number, total: number) => total ? 100 * n / total : 0;
export const date = (s: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(s)) + ' UTC';
export const categoryName = (name: string) => ({ game: 'Game and Nu2', sdk: 'Dolphin SDK', runtime: 'SN runtime', other: 'Unclassified code' })[name] || name;
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
export function delta(history: Dataset['history'], current: Measures) {
  const prior = history.at(-2);
  if (!prior || prior.measures.total_code !== current.total_code || prior.measures.total_functions !== current.total_functions) return null;
  return { bytes: current.matched_code - prior.measures.matched_code,
    functions: current.matched_functions - prior.measures.matched_functions, since: prior.report_at };
}
// Labels for the "since previous report" card. One report is not a zero gain.
export function change(history: Dataset['history'], current: Measures) {
  if (history.length < 2) return { value: 'First report', detail: 'Changes appear after the next build' };
  const d = delta(history, current);
  if (!d) return { value: 'Not comparable', detail: 'Totals changed since the last report' };
  const sign = (n: number) => (n > 0 ? '+' : '') + format(n);
  return { value: `${sign(d.bytes)} B`, detail: `${sign(d.functions)} functions since ${date(d.since)}` };
}
