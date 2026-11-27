'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const hintId = useId();
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const table = tableRef.current;
    if (!container || !table) return;

    // The viewport can resize, and filtering can change the table's intrinsic width.
    const observer = new ResizeObserver(() => {
      setOverflowing(container.scrollWidth > container.clientWidth);
    });
    observer.observe(container);
    observer.observe(table);
    return () => observer.disconnect();
  }, []);

  return <>
    {overflowing && <p id={hintId} className="table-scroll-hint">Scroll sideways for more columns.</p>}
    <div
      ref={containerRef}
      className="table-scroll"
      tabIndex={overflowing ? 0 : undefined}
      role={overflowing ? 'region' : undefined}
      aria-label={overflowing ? label : undefined}
      aria-describedby={overflowing ? hintId : undefined}
    >
      <table ref={tableRef} aria-label={label}>{children}</table>
    </div>
  </>;
}
