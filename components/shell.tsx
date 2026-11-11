'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFeed } from './feed';
import { date } from '@/lib/stats';
export function Navigation() {
  const path = usePathname();
  return <nav aria-label="Main navigation">{[['/', 'Progress'], ['/units', 'Units'], ['/candidates', 'Candidates']].map(([href, label]) => <Link key={href} href={href} aria-current={(href === '/' ? path === '/' : path.startsWith(href)) ? 'page' : undefined}>{label}</Link>)}</nav>;
}
export function Freshness() {
  const { data, source, warning } = useFeed();
  const s = data.latest;
  // A bundled snapshot has no recorded build revision, so it must not read as a verified build.
  if (source === 'bundled') return <div className="freshness">
    <p className="warning" role="status"><span className="status-dot" />Live build stats are unavailable right now. Showing a saved snapshot from {date(s.report_at)}, not tied to a specific build.</p>
  </div>;
  return <div className="freshness">
    <p><span className="status-dot published" />Stats from the latest successful build, {date(s.report_at)}{s.revision && <> · commit <a href={`https://github.com/ellierocks767/lsw1-decomp/commit/${s.revision}`}>{s.revision.slice(0, 7)}</a></>}{s.build_url && <> · <a href={s.build_url}>build log</a></>}. Updates automatically.</p>
    {warning && <p className="warning" role="status">{warning}</p>}
  </div>;
}
