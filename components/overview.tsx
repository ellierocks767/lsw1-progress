'use client';
import Link from 'next/link';
import { useFeed } from './feed';
import { categories, categoryName, date, delta, format, kib, percent, unitHref } from '@/lib/stats';
export function Bar({ value }: { value: number }) { return <div className="track"><div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>; }
export function Overview() {
  const { data } = useFeed(); const m = data.latest.measures;
  const gain = delta(data.history, m), remaining = m.total_code - m.matched_code;
  const top = [...data.latest.units].filter(u => u.measures.total_code > u.measures.matched_code).sort((a,b) => (b.measures.total_code-b.measures.matched_code)-(a.measures.total_code-a.measures.matched_code)).slice(0,6);
  const sign = (n: number) => (n > 0 ? '+' : '') + format(n);
  return <><div className="page-heading"><div><h1>Matching progress</h1><p>How much of the retail executable matches the reconstructed source.</p></div></div>
    <div className="metrics">{[
      ['Code matched', `${percent(m.matched_code,m.total_code).toFixed(1)}%`, `${kib(m.matched_code)} of ${kib(m.total_code)}`],
      ['Functions matched', format(m.matched_functions), `${percent(m.matched_functions,m.total_functions).toFixed(1)}% of ${format(m.total_functions)} functions`],
      ['Code remaining', kib(remaining), `${format(m.total_functions-m.matched_functions)} functions`],
      ['Since previous report', gain ? `${sign(gain.bytes)} B` : 'No comparison', gain ? `${sign(gain.functions)} functions · ${date(gain.since)}` : 'Needs two reports with the same totals'],
    ].map(([label,value,detail]) => <section className="metric" key={label}><h2>{label}</h2><strong>{value}</strong><small>{detail}</small></section>)}</div>
    <div className="grid"><section className="panel"><h2>Code coverage by subsystem</h2>{categories(data.latest.units).map(([name,g]) => <div className="coverage" key={name}><div className="row"><b>{categoryName(name)}</b><span>{percent(g.matched,g.total).toFixed(1)}%</span></div><Bar value={percent(g.matched,g.total)} /><small>{kib(g.matched)} / {kib(g.total)} · {format(g.done)} / {format(g.functions)} functions</small></div>)}<p className="note">Categories follow the build report. Unclassified ranges may include code without source-backed units.</p></section>
    <section className="panel"><h2>Completion</h2>{[
      ['Code in complete units', m.complete_code, m.total_code, kib],
      ['Matched data', m.matched_data, m.total_data, kib],
      ['Complete report units', m.complete_units, m.total_units, format],
    ].map(([label,a,b,f]) => { const n=a as number,t=b as number,fn=f as (v:number)=>string;return <div className="coverage" key={label as string}><div className="row"><span>{label as string}</span><span>{percent(n,t).toFixed(1)}%</span></div><Bar value={percent(n,t)} /><small>{fn(n)} / {fn(t)}</small></div>;})}<p className="note">Complete units can include data-only units. Promotion also requires matching sections, relocations and linked retail ranges.</p></section>
    <section className="panel"><h2>Progress over time</h2><History /> </section>
    <section className="panel"><div className="row section-heading"><h2>Largest remaining units</h2><Link href="/units">All units →</Link></div>{top.map(u => <div className="coverage" key={u.name}><div className="row"><Link className="mono" href={unitHref(u.name)}>{u.name}</Link><span className="nowrap">{kib(u.measures.total_code-u.measures.matched_code)}</span></div><Bar value={percent(u.measures.matched_code,u.measures.total_code)} /></div>)}</section></div></>;
}
function History() {
  const { data } = useFeed();const points=data.history;
  if(points.length<2)return <div className="empty"><strong>One report recorded</strong><p>Each successful main build adds a point. A trend will appear after the next report.</p></div>;
  const times=points.map(p=>new Date(p.report_at).getTime()),start=Math.min(...times),span=Math.max(...times)-start||1;
  const x=(i:number)=>40+((times[i]-start)/span)*640;
  const y=(i:number)=>190-percent(points[i].measures.matched_code,points[i].measures.total_code)*1.6;
  const path=points.map((_,i)=>`${i?'L':'M'} ${x(i)} ${y(i)}`).join(' ');
  return <><svg className="history-chart" viewBox="0 0 720 220" role="img" aria-label="Matched code percentage by report date">{[0,50,100].map(v=><g key={v}><line x1="40" x2="680" y1={190-v*1.6} y2={190-v*1.6} stroke="var(--border)"/><text x="0" y={194-v*1.6} fill="var(--muted)" fontSize="12">{v}%</text></g>)}<path d={path} fill="none" stroke="var(--accent)" strokeWidth="3"/>{points.map((p,i)=><circle key={p.id} cx={x(i)} cy={y(i)} r="4" fill="var(--accent)"><title>{date(p.report_at)}: {percent(p.measures.matched_code,p.measures.total_code).toFixed(2)}%</title></circle>)}</svg><div className="row note"><span>{date(points[0].report_at)}</span><span>{date(points.at(-1)!.report_at)}</span></div><details><summary>{format(points.length)} recorded builds</summary><div className="table-scroll"><table><thead><tr><th>Report</th><th>Code matched</th><th>Functions</th></tr></thead><tbody>{[...points].reverse().map(p=><tr key={p.id}><td>{date(p.report_at)}</td><td>{kib(p.measures.matched_code)} ({percent(p.measures.matched_code,p.measures.total_code).toFixed(2)}%)</td><td>{format(p.measures.matched_functions)}</td></tr>)}</tbody></table></div></details></>;
}
