'use client';

import { useState, type ReactNode } from 'react';
import { format } from '@/lib/stats';
import { TableScroll } from './table-scroll';

const ROWS_PER_PAGE = 50;

export function PaginatedTable<Row>({
  label, rows, filterKey, header, renderRow,
}: {
  label: string;
  rows: readonly Row[];
  filterKey: string;
  header: ReactNode;
  renderRow: (row: Row, index: number) => ReactNode;
}) {
  const [selection, setSelection] = useState({ filterKey, page: 0 });
  const lastPage = Math.max(0, Math.ceil(rows.length / ROWS_PER_PAGE) - 1);
  const filtersChanged = filterKey !== selection.filterKey;
  const page = filtersChanged ? 0 : Math.min(selection.page, lastPage);
  // Reset on filter changes and keep the clamped position if a live report removes pages.
  if (filtersChanged || page !== selection.page) setSelection({ filterKey, page });

  const start = page * ROWS_PER_PAGE;
  const end = Math.min(start + ROWS_PER_PAGE, rows.length);
  return <>
    {lastPage > 0 && <div className="table-pagination" role="group" aria-label={`${label} pages`}>
      <span role="status">Showing {format(start + 1)}–{format(end)} of {format(rows.length)}</span>
      <div className="table-page-buttons">
        <button type="button" aria-disabled={page === 0} onClick={() => {
          if (page > 0) setSelection({ filterKey, page: page - 1 });
        }}>Previous</button>
        <button type="button" aria-disabled={page === lastPage} onClick={() => {
          if (page < lastPage) setSelection({ filterKey, page: page + 1 });
        }}>Next</button>
      </div>
    </div>}
    <TableScroll label={label}>
      {header}
      <tbody>{rows.slice(start, end).map((row, index) => renderRow(row, start + index))}</tbody>
    </TableScroll>
  </>;
}
