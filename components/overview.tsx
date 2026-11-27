'use client';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useFeed } from './feed';
import { TableScroll } from './table-scroll';
import {
  buildCodeMap,
  CODE_MAP_HEIGHT,
  CODE_MAP_ROW_HEIGHT,
  CODE_MAP_SHADES,
  CODE_MAP_WIDTH,
  findFunctionAtPoint,
  type CodeMapUnit,
} from '@/lib/code-map';
import { ariaPercent, categories, categoryName, change, codeCoverage, date, format, formatPercent, formatSimilarity, kib, percent, unitHref } from '@/lib/stats';
import type { Dataset } from '@/lib/schema';

export function Bar({ value }: { value: number }) {
  return <div className="track"><div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

function Meter({ label, value, detail, href }: { label: string; value: number | null; detail?: string; href?: string }) {
  return <div className="meter">
    <div className="row">{href ? <Link className="mono" href={href}>{label}</Link> : <span>{label}</span>}<span className="figure">{value === null ? 'None' : formatPercent(value,1)}</span></div>
    <Bar value={value ?? 0} />
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
        ['Code matched', formatPercent(code,2), `${kib(m.matched_code)} of ${kib(m.total_code)}`],
        ['Functions matched', `${format(m.matched_functions)} / ${format(m.total_functions)}`, 'Fully matching / total'],
        ['Code remaining', kib(m.total_code - m.matched_code), `Across ${format(m.total_functions - m.matched_functions)} unmatched functions`],
        ['Since previous report', since.value, since.detail],
      ].map(([label, value, detail]) => <div className="stat" key={label}><h2>{label}</h2><strong>{value}</strong><small>{detail}</small></div>)}</div>
      <div className="track big" role="progressbar" aria-label="Code matched" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ariaPercent(code)}><div style={{ width: `${Math.min(100, code)}%` }} /></div>
    </section>

    <div className="grid">
      <section className="panel">
        <h2>Code by subsystem</h2>
        {categories(data.latest.units).sort(([, a], [, b]) => percent(b.matched, b.total) - percent(a.matched, a.total)).map(([name, g]) => <Meter key={name} label={categoryName(name)} value={g.total === 0 ? null : percent(g.matched, g.total)}
          detail={`${kib(g.matched)} / ${kib(g.total)} · ${format(g.done)} / ${format(g.functions)} functions`} />)}
      </section>

      <section className="panel">
        <h2>Completion</h2>
        {[
          { label: 'Code in complete units', value: m.total_code === 0 ? null : percent(m.complete_code, m.total_code), detail: `${kib(m.complete_code)} / ${kib(m.total_code)}` },
          { label: 'Complete units', value: m.total_units === 0 ? null : percent(m.complete_units, m.total_units), detail: `${format(m.complete_units)} / ${format(m.total_units)}, including data-only units` },
          { label: 'Matched data', value: m.total_data === 0 ? null : percent(m.matched_data, m.total_data), detail: `${kib(m.matched_data)} / ${kib(m.total_data)}` },
        ].sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).map(x => <Meter key={x.label} {...x} />)}
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
      {points.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(i)} r="4" fill="var(--accent)"><title>{date(p.report_at)}: {formatPercent(percent(p.measures.matched_code, p.measures.total_code),2)}</title></circle>)}
    </svg>
    <div className="row detail"><span>{date(points[0].report_at)}</span><span>{date(points.at(-1)!.report_at)}</span></div>
    <details><summary>{format(points.length)} reports</summary><TableScroll label="Report history"><thead><tr><th scope="col">Report</th><th scope="col" className="num">Code matched</th><th scope="col" className="num">Functions</th></tr></thead><tbody>
      {[...points].reverse().map(p => <tr key={p.id}><th scope="row" className="nowrap"><time dateTime={p.report_at}>{date(p.report_at)}</time></th><td className="num">{kib(p.measures.matched_code)} ({formatPercent(percent(p.measures.matched_code, p.measures.total_code),2)})</td><td className="num">{format(p.measures.matched_functions)}</td></tr>)}
    </tbody></TableScroll></details>
  </>;
}

/* Lays functions out in rows of a fixed byte width, in dataset order. The decomp exporter
   (tools/export_progress.py) lists units and functions by load address; the seed matches. */
function CodeMap({ units }: { units: Dataset['latest']['units'] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<{ unit: string; tooltip: string | null } | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const layout = useMemo(() => buildCodeMap(units), [units]);
  const unitsByName = useMemo(() => new Map(units.map(u => [u.name, u])), [units]);
  const mapUnitsByName = useMemo(() => new Map(layout.units.map(u => [u.name, u])), [layout]);

  function updateHover(mapUnit: CodeMapUnit, clientX: number, clientY: number) {
    const unit = unitsByName.get(mapUnit.name);
    const svg = svgRef.current;
    let tooltip: string | null = null;
    if (unit && svg) {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const svgX = ((clientX - rect.left) / rect.width) * CODE_MAP_WIDTH;
        const svgY = ((clientY - rect.top) / rect.height) * CODE_MAP_HEIGHT;
        const fn = findFunctionAtPoint(unit, mapUnit, layout, svgX, svgY);
        if (fn) {
          tooltip = `${unit.name} · ${fn.name} · ${format(fn.size)} B · ${formatSimilarity(fn.similarity)}`;
        }
      }
    }
    setHovered(prev => (prev?.unit === mapUnit.name && prev.tooltip === tooltip ? prev : { unit: mapUnit.name, tooltip }));
  }

  const activeName = focused ?? hovered?.unit ?? null;
  const active = activeName ? unitsByName.get(activeName) : undefined;
  const activeMapUnit = activeName ? mapUnitsByName.get(activeName) : undefined;
  const m = active?.measures;

  return <>
    <div className="row section-heading"><h2>Code map</h2>
      <ul className="legend">{CODE_MAP_SHADES.map(s => <li key={s.label}><span style={{ background: s.color }} />{s.label}</li>)}</ul></div>
    <p className="map-readout" aria-live="polite">{active && m
      ? <><span className="mono">{active.name}</span> · {codeCoverage(m)} · {format(m.matched_functions)} / {format(m.total_functions)} functions{active.complete && <> · <span className="good">complete</span></>}</>
      : 'Hover or focus a unit to see its progress.'}</p>
    <svg ref={svgRef} className="code-map" viewBox={`0 0 ${CODE_MAP_WIDTH} ${CODE_MAP_HEIGHT}`} role="group" aria-label="Functions by objdiff similarity, sized by code bytes">
      {layout.shadePaths.map(path => <path key={path.label} d={path.d} fill={path.color} pointerEvents="none" />)}
      {layout.dividersPath && <path className="map-dividers" d={layout.dividersPath} />}
      {layout.units.map(u => <a key={u.name} href={unitHref(u.name)} aria-label={u.name}
        onMouseEnter={e => updateHover(u, e.clientX, e.clientY)}
        onMouseMove={e => updateHover(u, e.clientX, e.clientY)}
        onMouseLeave={() => setHovered(prev => (prev?.unit === u.name ? null : prev))}
        onFocus={() => setFocused(u.name)}
        onBlur={() => setFocused(prev => (prev === u.name ? null : prev))}>
        {hovered?.unit === u.name && hovered.tooltip && <title>{hovered.tooltip}</title>}
        {u.spans.map(span => <rect key={span.row} x={span.x1} y={span.y} width={span.width} height={CODE_MAP_ROW_HEIGHT} fill="transparent" />)}
        {u.labels.map(label => <text key={label.row} x={label.x} y={label.y}>{u.short}</text>)}
      </a>)}
      {activeMapUnit && <g className="map-outline">
        {activeMapUnit.spans.map(span => <rect key={span.row} x={span.x1} y={span.y} width={span.width} height={CODE_MAP_ROW_HEIGHT} />)}
      </g>}
    </svg>
    <p className="detail">Each block is a function, sized by its code bytes and coloured by objdiff similarity, in load-address order. Dark lines separate units, which are labelled where they fit.</p>
  </>;
}
