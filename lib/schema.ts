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
export const datasetSchema = z.object({
  schema_version: z.literal(1),
  latest: point.extend({
    generated_at: stamp,
    build_url: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/).nullable(),
    units: z.array(z.object({ name: z.string(), category: z.string(), complete: z.boolean(), measures: measuresSchema,
      functions: z.array(z.object({ name: z.string(), size: count, similarity: z.number().min(0).max(100) })) })),
    candidates: z.object({ sweep_at: stamp.nullable(), verdicts: z.record(z.string(), count), rows: z.array(candidate) }).nullable(),
  }),
  history: z.array(point),
});
export type Dataset = z.infer<typeof datasetSchema>;
export type Measures = z.infer<typeof measuresSchema>;
export type Unit = Dataset['latest']['units'][number];
export type Feed = { data: Dataset; source: 'published' | 'bundled'; warning: string | null };
