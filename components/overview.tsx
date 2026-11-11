'use client';
import Link from 'next/link';
import { useFeed } from './feed';
import { categories, categoryName, change, date, format, kib, percent, unitHref } from '@/lib/stats';
import type { Dataset } from '@/lib/schema';

export function Bar({ value }: { value: number }) {
  return <div className="track"><div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

function Meter({ label, value, detail, href }: { label: string; value: number; detail?: string; href?: string }) {
  return <div className="meter">
    <div className="row">{href ? <Link className="mono" href={href}>{label}</Link> : <span>{label}</span>}<span className="figure">{value.toFixed(1)}%</span></div>
    <Bar value={value} />
    {detail && <p className="detail">{detail}</p>}
  </div>;
}

export function Overview() {
  const { data } = useFeed();
  const m = data.latest.measures;
  const since = change(data.history, m);
  const top = data.latest.units
    .map(u => ({ u, left: u.measures.total_code - u.measures.matched_code }))
    .filter(x => x.left > 0)
    .sort((a, b) => b.left - a.left)
    .slice(0, 6);
  const trend = data.history.length >= 2;

  return <>
    <h1>Matching progress</h1>
    <div className="metrics">{[
      ['Code matched', `${percent(m.matched_code, m.total_code).toFixed(1)}%`, `${kib(m.matched_code)} of ${kib(m.total_code)}`],
      ['Functions matched', format(m.matched_functions), `${percent(m.matched_functions, m.total_functions).toFixed(1)}% of ${format(m.total_functions)}`],
      ['Code remaining', kib(m.total_code - m.matched_code), `${format(m.total_functions - m.matched_functions)} functions`],
      ['Since previous report', since.value, since.detail],
    ].map(([label, value, detail]) => <section className="metric" key={label}><h2>{label}</h2><strong>{value}</strong><small>{detail}</small></section>)}</div>

    <div className="grid">
      <section className="panel">
        <h2>Code by subsystem</h2>
        {categories(data.latest.units).map(([name, g]) => <Meter key={name} label={categoryName(name)} value={percent(g.matched, g.total)}
          detail={`${kib(g.matched)} / ${kib(g.total)} · ${format(g.done)} / ${format(g.functions)} functions`} />)}
      </section>

      <section className="panel">
        <h2>Completion</h2>
        <Meter label="Code in complete units" value={percent(m.complete_code, m.total_code)} detail={`${kib(m.complete_code)} / ${kib(m.total_code)}`} />
        <Meter label="Complete units" value={percent(m.complete_units, m.total_units)} detail={`${format(m.complete_units)} / ${format(m.total_units)}, including data-only units`} />
        <Meter label="Matched data" value={percent(m.matched_data, m.total_data)} detail={`${kib(m.matched_data)} / ${kib(m.total_data)}`} />
        <p className="caveat">Objdiff matches are not promotion. Promotion also needs matching sections, relocations and linked retail ranges.</p>
      </section>

      {trend && <section className="panel"><h2>Progress over time</h2><History points={data.history} /></section>}

      <section className={trend ? 'panel' : 'panel wide'}>
        <div className="row section-heading"><h2>Largest remaining units</h2><Link href="/units">All units →</Link></div>
        <div className="unit-list" style={{ '--rows': Math.ceil(top.length / 2) } as React.CSSProperties}>{top.map(({ u, left }) => <Meter key={u.name} label={u.name} href={unitHref(u.name)} value={percent(u.measures.matched_code, u.measures.total_code)}
          detail={`${kib(left)} left · ${format(u.measures.total_functions - u.measures.matched_functions)} functions`} />)}</div>
      </section>
    </div>
  </>;
}

function History({ points }: { points: Dataset['history'] }) {
  const times = points.map(p => new Date(p.report_at).getTime()), start = Math.min(...times), span = Math.max(...times) - start || 1;
  const x = (i: number) => 40 + ((times[i] - start) / span) * 640;
  const y = (i: number) => 190 - percent(points[i].measures.matched_code, points[i].measures.total_code) * 1.6;
  const path = points.map((_, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(i)}`).join(' ');
  return <>
    <svg className="history-chart" viewBox="0 0 720 220" role="img" aria-label="Matched code percentage by report date">
      {[0, 50, 100].map(v => <g key={v}><line x1="40" x2="680" y1={190 - v * 1.6} y2={190 - v * 1.6} stroke="var(--border)" /><text x="0" y={194 - v * 1.6} fill="var(--muted)" fontSize="13">{v}%</text></g>)}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="3" />
      {points.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(i)} r="4" fill="var(--accent)"><title>{date(p.report_at)}: {percent(p.measures.matched_code, p.measures.total_code).toFixed(2)}%</title></circle>)}
    </svg>
    <div className="row detail"><span>{date(points[0].report_at)}</span><span>{date(points.at(-1)!.report_at)}</span></div>
    <details><summary>{format(points.length)} reports</summary><div className="table-scroll"><table><thead><tr><th>Report</th><th className="num">Code matched</th><th className="num">Functions</th></tr></thead><tbody>
      {[...points].reverse().map(p => <tr key={p.id}><td>{date(p.report_at)}</td><td className="num">{kib(p.measures.matched_code)} ({percent(p.measures.matched_code, p.measures.total_code).toFixed(2)}%)</td><td className="num">{format(p.measures.matched_functions)}</td></tr>)}
    </tbody></table></div></details>
  </>;
}
