'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
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

  const code = percent(m.matched_code, m.total_code);

  return <>
    <div className="page-heading"><div><h1>Matching progress</h1><p>Objdiff results for the GameCube build of LEGO Star Wars: The Video Game (GL5E4F).</p></div></div>
    <section className="panel hero">
      <div className="stats">{[
        ['Code matched', `${code.toFixed(2)}%`, `${kib(m.matched_code)} of ${kib(m.total_code)} in objdiff-matched functions`],
        ['Functions matched', `${format(m.matched_functions)} / ${format(m.total_functions)}`, 'Fully matching / total'],
        ['Code remaining', kib(m.total_code - m.matched_code), `Across ${format(m.total_functions - m.matched_functions)} unmatched functions`],
        ['Since previous report', since.value, since.detail],
      ].map(([label, value, detail]) => <div className="stat" key={label}><h2>{label}</h2><strong>{value}</strong><small>{detail}</small></div>)}</div>
      <div className="track big" role="progressbar" aria-label="Code matched" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(code.toFixed(2))}><div style={{ width: `${Math.min(100, code)}%` }} /></div>
    </section>

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

      <section className="panel wide"><CodeMap units={data.latest.units} /></section>

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

const shades = [
  { min: 100, label: '100%', color: 'var(--green)' },
  { min: 90, label: '90–99%', color: 'var(--lime)' },
  { min: 0.01, label: 'Under 90%', color: 'var(--warning)' },
  { min: 0, label: '0%', color: 'var(--track)' },
];
const shade = (similarity: number) => shades.find(s => similarity >= s.min)!.color;

/* Lays functions out in rows of a fixed byte width, in the order the build report lists them.
   That order is not guaranteed to be address order, so the map never claims addresses. */
function CodeMap({ units }: { units: Dataset['latest']['units'] }) {
  const [hover, setHover] = useState<Dataset['latest']['units'][number] | null>(null);
  const rows = 16, width = 1000, height = 22, gap = 6;
  // Build the blocks once per dataset so hovering only redraws the outline and readout.
  const { groups, outlines } = useMemo(() => {
  const total = units.reduce((n, u) => n + u.functions.reduce((a, f) => a + f.size, 0), 0) || 1;
  const perRow = Math.ceil(total / rows);
  const scale = width / perRow;
  let offset = 0;
  const outlines = new Map<string, React.ReactNode[]>();
  const groups = units.filter(u => u.functions.length).map(u => {
    const rects: React.ReactNode[] = [], spans = new Map<number, [number, number]>();
    u.functions.forEach((f, i) => {
      let start = offset, left = f.size;
      while (left > 0) {
        const row = Math.floor(start / perRow), inRow = Math.min(left, (row + 1) * perRow - start);
        const x = (start - row * perRow) * scale, w = inRow * scale, span = spans.get(row);
        spans.set(row, [span ? span[0] : x, x + w]);
        rects.push(<rect key={`${i}-${row}`} x={x} y={row * (height + gap)} width={w} height={height} fill={shade(f.similarity)}>
          <title>{`${u.name} · ${f.name} · ${format(f.size)} B · ${f.similarity.toFixed(1)}%`}</title></rect>);
        start += inRow; left -= inRow;
      }
      offset += f.size;
    });
    // Label the unit wherever its run is wide enough to hold the short name.
    outlines.set(u.name, [...spans].map(([row, [a, b]]) => <rect key={row} x={a} y={row * (height + gap)} width={b - a} height={height} />));
    const short = u.name.split('/').at(-1)!;
    const labels = [...spans].filter(([, [a, b]]) => b - a >= short.length * 6.4 + 8).map(([row, [a, b]]) =>
      <text key={`label-${row}`} x={(a + b) / 2} y={row * (height + gap) + height / 2}>{short}</text>);
    return <a key={u.name} href={unitHref(u.name)} aria-label={u.name} onMouseEnter={() => setHover(u)} onFocus={() => setHover(u)}>{rects}{labels}</a>;
  });
  return { groups, outlines };
  }, [units]);
  const m = hover?.measures;
  return <>
    <div className="row section-heading"><h2>Code map</h2>
      <ul className="legend">{shades.map(s => <li key={s.label}><span style={{ background: s.color }} />{s.label}</li>)}</ul></div>
    <p className="map-readout" aria-live="polite">{hover && m
      ? <><span className="mono">{hover.name}</span> · {percent(m.matched_code, m.total_code).toFixed(1)}% · {format(m.matched_functions)} / {format(m.total_functions)} functions{hover.complete && <> · <span className="good">complete</span></>}</>
      : 'Hover a block to see its unit.'}</p>
    <svg className="code-map" viewBox={`0 0 ${width} ${rows * (height + gap) - gap}`} role="img" aria-label="Functions by objdiff similarity, sized by code bytes" onMouseLeave={() => setHover(null)}>{groups}{hover && <g className="map-outline">{outlines.get(hover.name)}</g>}</svg>
    <p className="detail">Each block is a function, sized by its code bytes and coloured by objdiff similarity, in build-report order. Units are labelled where they fit; hover for the rest, click to open one.</p>
  </>;
}
