import type { Unit } from './schema';

export const CODE_MAP_ROWS = 16;
export const CODE_MAP_WIDTH = 1000;
export const CODE_MAP_ROW_HEIGHT = 22;
export const CODE_MAP_ROW_GAP = 6;
export const CODE_MAP_HEIGHT = CODE_MAP_ROWS * (CODE_MAP_ROW_HEIGHT + CODE_MAP_ROW_GAP) - CODE_MAP_ROW_GAP;

export const CODE_MAP_SHADES = [
  { label: '100%', color: 'var(--green)' },
  { label: '90% to <100%', color: 'var(--lime)' },
  { label: 'Under 90%', color: 'var(--warning)' },
  { label: '0%', color: 'var(--track)' },
] as const;

export function shadeIndex(similarity: number): number {
  if (similarity >= 100) return 0;
  if (similarity >= 90) return 1;
  if (similarity > 0) return 2;
  return 3;
}

export type CodeMapSpan = {
  row: number;
  x1: number;
  x2: number;
  y: number;
  width: number;
};

export type CodeMapLabel = {
  row: number;
  x: number;
  y: number;
};

export type CodeMapUnit = {
  name: string;
  short: string;
  startOffset: number;
  endOffset: number;
  spans: CodeMapSpan[];
  labels: CodeMapLabel[];
};

export type CodeMapShadePath = {
  label: string;
  color: string;
  d: string;
};

export type CodeMapLayout = {
  totalBytes: number;
  perRow: number;
  scale: number;
  shadePaths: CodeMapShadePath[];
  dividersPath: string;
  units: CodeMapUnit[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildCodeMap(units: Unit[]): CodeMapLayout {
  const totalBytes = units.reduce(
    (sum, unit) => sum + unit.functions.reduce((acc, fn) => acc + fn.size, 0),
    0,
  );
  const perRow = Math.ceil((totalBytes || 1) / CODE_MAP_ROWS);
  const scale = CODE_MAP_WIDTH / perRow;
  const stride = CODE_MAP_ROW_HEIGHT + CODE_MAP_ROW_GAP;

  const shadeSegments: string[][] = CODE_MAP_SHADES.map(() => []);
  const dividerSegments: string[] = [];
  const mapUnits: CodeMapUnit[] = [];

  let offset = 0;
  let runRow = -1;
  let runShade = -1;
  let runStartByte = 0;
  let runEndByte = 0;

  const flushRun = () => {
    if (runRow < 0 || runShade < 0 || runEndByte <= runStartByte) return;
    const rowStart = runRow * perRow;
    const x1 = round2((runStartByte - rowStart) * scale);
    const x2 = round2((runEndByte - rowStart) * scale);
    const width = round2(x2 - x1);
    if (width > 0) {
      const y = runRow * stride;
      shadeSegments[runShade].push(`M${x1} ${y}h${width}v${CODE_MAP_ROW_HEIGHT}h${-width}z`);
    }
    runRow = -1;
    runShade = -1;
  };

  for (const unit of units) {
    if (!unit.functions.length) continue;
    const unitStart = offset;
    const rowRanges = new Map<number, [number, number]>();

    for (const fn of unit.functions) {
      if (fn.size <= 0) continue;
      const fnShade = shadeIndex(fn.similarity);
      let start = offset;
      let left = fn.size;
      while (left > 0) {
        const row = Math.floor(start / perRow);
        const rowEnd = (row + 1) * perRow;
        const inRow = Math.min(left, rowEnd - start);
        const end = start + inRow;

        const existing = rowRanges.get(row);
        rowRanges.set(row, [existing ? existing[0] : start, end]);

        if (row === runRow && fnShade === runShade && start === runEndByte) {
          runEndByte = end;
        } else {
          flushRun();
          runRow = row;
          runShade = fnShade;
          runStartByte = start;
          runEndByte = end;
        }

        start = end;
        left -= inRow;
      }
      offset += fn.size;
    }

    if (!rowRanges.size) continue;

    const short = unit.name.split('/').at(-1) ?? unit.name;
    const minLabelWidth = short.length * 6.4 + 8;
    const spans: CodeMapSpan[] = [];
    const labels: CodeMapLabel[] = [];

    for (const [row, [startByte, endByte]] of rowRanges) {
      const rowStart = row * perRow;
      const x1 = round2((startByte - rowStart) * scale);
      const x2 = round2((endByte - rowStart) * scale);
      const width = round2(x2 - x1);
      const y = row * stride;
      spans.push({ row, x1, x2, y, width });
      if (x1 > 0) {
        dividerSegments.push(`M${x1} ${y}v${CODE_MAP_ROW_HEIGHT}`);
      }
      if (width >= minLabelWidth) {
        labels.push({ row, x: round2((x1 + x2) / 2), y: y + CODE_MAP_ROW_HEIGHT / 2 });
      }
    }

    mapUnits.push({
      name: unit.name,
      short,
      startOffset: unitStart,
      endOffset: offset,
      spans,
      labels,
    });
  }

  flushRun();

  const shadePaths = CODE_MAP_SHADES
    .map((shade, index) => ({
      label: shade.label,
      color: shade.color,
      d: shadeSegments[index].join(''),
    }))
    .filter(path => path.d.length > 0);

  return {
    totalBytes,
    perRow,
    scale,
    shadePaths,
    dividersPath: dividerSegments.join(''),
    units: mapUnits,
  };
}

export function findFunctionAtPoint(
  unit: Unit,
  mapUnit: CodeMapUnit,
  layout: Pick<CodeMapLayout, 'perRow' | 'scale'>,
  svgX: number,
  svgY: number,
): Unit['functions'][number] | null {
  if (mapUnit.endOffset <= mapUnit.startOffset) return null;
  const stride = CODE_MAP_ROW_HEIGHT + CODE_MAP_ROW_GAP;
  const row = Math.floor(svgY / stride);
  if (row < 0 || row >= CODE_MAP_ROWS) return null;
  if (svgY - row * stride > CODE_MAP_ROW_HEIGHT) return null;

  const clampedX = Math.min(CODE_MAP_WIDTH, Math.max(0, svgX));
  const rawOffset = row * layout.perRow + Math.floor(clampedX / layout.scale);
  const targetOffset = Math.min(mapUnit.endOffset - 1, Math.max(mapUnit.startOffset, rawOffset));

  let cursor = mapUnit.startOffset;
  for (const fn of unit.functions) {
    if (fn.size <= 0) continue;
    const next = cursor + fn.size;
    if (targetOffset < next) return fn;
    cursor = next;
  }
  return null;
}
