import { createHash } from 'node:crypto';
import { getProgress } from '@/lib/progress';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const body = JSON.stringify(await getProgress());
  const tag = `"${createHash('sha256').update(body).digest('hex')}"`;
  const headers = { 'Cache-Control': 'private, no-cache', ETag: `W/${tag}` };
  const validators = request.headers.get('If-None-Match')?.split(',');
  if (validators?.some(value => ['*', tag, headers.ETag].includes(value.trim()))) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { headers: { ...headers, 'Content-Type': 'application/json' } });
}
