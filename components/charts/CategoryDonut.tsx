'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltipBox } from '@/components/charts/ChartTooltip';
import type { CategorySlice } from '@/lib/stats/series';
import { formatCompactWon, formatWon } from '@/lib/stats/series';
import { cn } from '@/lib/utils';

interface CategoryDonutProps {
  slices: CategorySlice[];
  total: number;
  /** 가운데 라벨 (예: '총 지출') */
  centerLabel?: string;
  /** 강조할 카테고리 (?category=) */
  highlightId?: string | null;
}

/**
 * 카테고리 도넛 + 금액/비율 범례.
 * 조각 사이 2px 표면색 간격, 범례에 금액·%를 항상 적어 색에만 의존하지 않는다.
 */
export default function CategoryDonut({ slices, total, centerLabel = '총 지출', highlightId }: CategoryDonutProps) {
  if (slices.length === 0 || total <= 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-2xl bg-secondary/30 text-sm text-muted-foreground">
        <span>아직 기록된 지출이 없어요</span>
      </div>
    );
  }

  const hasHighlight = !!highlightId && slices.some((s) => s.id === highlightId);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative mx-auto h-[184px] w-[184px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices as Array<CategorySlice & Record<string, unknown>>}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={90}
              startAngle={90}
              endAngle={-270}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell
                  key={slice.id}
                  fill={slice.color}
                  fillOpacity={hasHighlight && slice.id !== highlightId ? 0.35 : 1}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const item = active && payload?.[0] ? (payload[0].payload as CategorySlice) : null;
                if (!item) return null;
                return (
                  <ChartTooltipBox
                    rows={[
                      {
                        key: item.id,
                        label: `${item.name} · ${(item.share * 100).toFixed(1)}%`,
                        value: formatWon(item.amount),
                        color: item.color,
                      },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* 가운데 합계 */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">{centerLabel}</span>
          <span className="text-xl font-extrabold tracking-tight text-foreground">
            {total >= 10_000_000 ? formatCompactWon(total) + '원' : formatWon(total)}
          </span>
        </div>
      </div>

      {/* 범례 = 표 보기: 색 칩 + 이름 + 비율 + 금액 (아이콘 색이 범례 색과 섞이지 않도록 아이콘은 생략) */}
      <ul className="flex flex-col" aria-label="카테고리별 지출">
        {slices.map((slice) => {
          const highlighted = hasHighlight && slice.id === highlightId;
          return (
            <li
              key={slice.id}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5',
                highlighted && 'bg-primary/5 ring-2 ring-primary/50'
              )}
            >
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[4px]" style={{ backgroundColor: slice.color }} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
                {slice.name}
                {slice.foldedCount && slice.foldedCount > 1 ? (
                  <span className="ml-1 text-xs font-medium text-muted-foreground">{slice.foldedCount}개</span>
                ) : null}
              </span>
              <span className="w-12 text-right text-[13px] font-medium tabular-nums text-muted-foreground">
                {(slice.share * 100).toFixed(slice.share < 0.1 ? 1 : 0)}%
              </span>
              <span className="w-[92px] text-right text-[15px] font-bold tabular-nums text-foreground">
                {formatWon(slice.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
