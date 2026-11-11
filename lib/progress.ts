import seed from '@/data/seed.json';
import { datasetSchema, type Feed } from './schema';

const fallback = datasetSchema.parse(seed);
export async function getProgress(): Promise<Feed> {
  const url = process.env.PROGRESS_DATA_URL || 'https://raw.githubusercontent.com/ellierocks767/lsw1-decomp/progress-data/progress.json';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('Progress URL must use HTTPS');
    const response = await fetch(url, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Progress feed returned ${response.status}`);
    const data = datasetSchema.parse(await response.json());
    return { data, source: 'published', warning: null };
  } catch {
    return { data: fallback, source: 'bundled', warning: 'Live build stats are unavailable. Showing a saved snapshot.' };
  }
}
