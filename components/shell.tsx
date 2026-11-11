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
  return <div className="freshness"><div><span className="status-dot" />{source === 'published' ? 'Published report' : 'Bundled snapshot'} · {date(s.report_at)}</div>{warning && <p className="warning" role="status">{warning}</p>}<small>{s.revision ? <>Revision <a href={`https://github.com/ellierocks767/lsw1-decomp/commit/${s.revision}`}>{s.revision.slice(0, 7)}</a></> : 'Local snapshot; build revision not recorded.'}{s.build_url && <> · <a href={s.build_url}>Build evidence</a></>} · Checks for new data every minute.</small></div>;
}
