import type { ReactNode } from 'react';

export interface ChartTooltipRow {
  key: string;
  label: string;
  value: string;
  /** 계열 키 색 (짧은 선으로 표시) */
  color?: string;
}

/** 차트 공용 툴팁 박스: 값이 강조, 이름은 보조 (dataviz 규칙) */
export function ChartTooltipBox({ title, rows, footer }: { title?: ReactNode; rows: ChartTooltipRow[]; footer?: ReactNode }) {
  return (
    <div className="min-w-[120px] rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      {title && <p className="mb-1 text-[11px] font-medium text-muted-foreground">{title}</p>}
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-[13px]">
            {row.color && (
              <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            )}
            <span className="font-bold tabular-nums text-foreground">{row.value}</span>
            <span className="text-muted-foreground">{row.label}</span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-1 text-[11px] text-muted-foreground">{footer}</p>}
    </div>
  );
}

/** 공통 축/그리드 스타일 (recessive 헤어라인) */
export const AXIS_TICK = { fontSize: 11, fill: 'var(--viz-ink-muted)' } as const;
export const GRID_STROKE = 'var(--viz-grid)';
