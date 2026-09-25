'use client';

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK, ChartTooltipBox, GRID_STROKE } from '@/components/charts/ChartTooltip';
import { formatCompactWon, formatWon } from '@/lib/stats/series';

export interface TrendData {
  name: string;
  income: number;
  expense: number;
  // 구버전 호환용 (사용하지 않음)
  incomeLabel?: string;
  expenseLabel?: string;
}

interface TrendChartProps {
  data: TrendData[];
}

const SERIES = [
  { key: 'income', label: '수입', color: 'var(--viz-income)' },
  { key: 'expense', label: '지출', color: 'var(--viz-expense)' },
] as const;

/**
 * 최근 사이클 수입/지출 묶음 막대 (한 축).
 * 범례 + 마지막(현재) 사이클에만 값 라벨, 나머지는 툴팁/표로 확인.
 */
export default function TrendChart({ data }: TrendChartProps) {
  const hasData = data.some((item) => item.income > 0 || item.expense > 0);
  const lastIndex = data.length - 1;

  const lastLabel = (props: unknown) => {
    const { x, y, width, value, index } = props as {
      x?: number;
      y?: number;
      width?: number;
      value?: number;
      index?: number;
    };
    if (index !== lastIndex || !value || x === undefined || y === undefined) return null;
    return (
      <text
        x={Number(x) + Number(width ?? 0) / 2}
        y={Number(y) - 6}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="var(--foreground)"
      >
        {formatCompactWon(Number(value))}
      </text>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 범례 */}
      <ul className="flex items-center gap-4 text-[13px] font-medium text-muted-foreground" aria-label="범례">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>

      <div className="relative h-[220px] w-full">
        {!hasData && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-card/60">
            <span className="text-sm font-medium text-muted-foreground">내역 없음</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="name"
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tickLine={false}
              tick={{ ...AXIS_TICK, fontSize: 12 }}
              interval={0}
              height={24}
            />
            <YAxis
              width={40}
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              tickCount={4}
              allowDecimals={false}
              tickFormatter={(v: number) => (v === 0 ? '0' : formatCompactWon(v))}
            />
            <Tooltip
              cursor={{ fill: 'var(--viz-grid)' }}
              content={({ active, payload, label }) => {
                const row = active && payload?.[0] ? (payload[0].payload as TrendData) : null;
                if (!row) return null;
                return (
                  <ChartTooltipBox
                    title={String(label ?? row.name)}
                    rows={SERIES.map((s) => ({ key: s.key, label: s.label, value: formatWon(row[s.key]), color: s.color }))}
                    footer={`남은 돈 ${formatWon(row.income - row.expense)}`}
                  />
                );
              }}
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                maxBarSize={14}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                <LabelList dataKey={s.key} content={lastLabel} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>사이클별 수입과 지출</caption>
        <thead>
          <tr>
            <th scope="col">사이클</th>
            <th scope="col">수입</th>
            <th scope="col">지출</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{formatWon(row.income)}</td>
              <td>{formatWon(row.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
