import { z } from 'zod';
const count = z.number().int().nonnegative();
export const measuresSchema = z.object({
  total_code: count, matched_code: count, complete_code: count,
  total_data: count, matched_data: count, total_functions: count,
  matched_functions: count, total_units: count, complete_units: count,
}).refine(m => m.matched_code <= m.total_code && m.complete_code <= m.total_code &&
  m.matched_functions <= m.total_functions && m.matched_data <= m.total_data &&
  m.complete_units <= m.total_units, 'Matched values exceed totals');
const revision = z.string().regex(/^[a-f0-9]{40}$/).nullable();
const stamp = z.string().datetime({ offset: true });
const point = z.object({ id: z.string(), revision, report_at: stamp, measures: measuresSchema });
const candidate = z.object({ name: z.string(), unit: z.string(), size: count, similarity: z.number().min(0).max(100) });
const datasetShape = z.object({
  schema_version: z.literal(1),
  latest: point.extend({
    generated_at: stamp,
    build_url: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/).nullable(),
    units: z.array(z.object({ name: z.string(), category: z.string(), complete: z.boolean(), measures: measuresSchema,
      functions: z.array(z.object({ name: z.string(), size: count, similarity: z.number().min(0).max(100) })) })),
    candidates: z.object({ sweep_at: stamp.nullable(), verdicts: z.record(z.string(), count), rows: z.array(candidate) }).nullable(),
  }),
  // Charts, the reports table and the previous-report comparison all assume oldest first.
  history: z.array(point).transform(points => [...points].sort((a, b) => Date.parse(a.report_at) - Date.parse(b.report_at))),
});
// The dashboard shows unit rows and headline totals side by side, so a feed whose parts disagree is
// rejected (and the bundled snapshot shown) rather than displayed with contradictory figures.
export const datasetSchema = datasetShape.superRefine(({ latest }, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['latest', 'units'] });
  const names = new Set<string>();
  const sum = { total_code: 0, matched_code: 0, complete_code: 0, total_functions: 0, matched_functions: 0, complete_units: 0 };
  for (const u of latest.units) {
    if (names.has(u.name)) fail(`Duplicate unit ${u.name}`);
    names.add(u.name);
    const m = u.measures;
    if (u.functions.length !== m.total_functions) fail(`${u.name}: function list disagrees with total_functions`);
    if (u.functions.filter(f => f.similarity >= 100).length !== m.matched_functions) fail(`${u.name}: matched functions disagree with similarity`);
    if (u.functions.reduce((s, f) => s + f.size, 0) > m.total_code) fail(`${u.name}: function sizes exceed total_code`);
    for (const k of ['total_code', 'matched_code', 'complete_code', 'total_functions', 'matched_functions'] as const) sum[k] += m[k];
    sum.complete_units += Number(u.complete);
  }
  for (const k of Object.keys(sum) as (keyof typeof sum)[]) if (sum[k] !== latest.measures[k]) fail(`Unit rows do not add up to ${k}`);
  if (latest.units.length > latest.measures.total_units) fail('More unit rows than total_units');
});
export type Dataset = z.infer<typeof datasetSchema>;
export type Measures = z.infer<typeof measuresSchema>;
export type Unit = Dataset['latest']['units'][number];
export type Feed = { data: Dataset; source: 'published' | 'bundled'; warning: string | null };
