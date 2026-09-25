'use client';

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK, ChartTooltipBox, GRID_STROKE } from '@/components/charts/ChartTooltip';
import { formatCompactWon, formatWon, type WeekdayPoint } from '@/lib/stats/series';

interface WeekdayPatternChartProps {
  data: WeekdayPoint[];
}

/**
 * 요일별 하루 평균 지출 (강조형: 가장 많이 쓰는 요일만 강조색, 나머지는 옅은 같은 계열).
 */
export default function WeekdayPatternChart({ data }: WeekdayPatternChartProps) {
  const peak = data.reduce<WeekdayPoint | null>((best, p) => (p.average > (best?.average ?? 0) ? p : best), null);
  const hasData = !!peak;

  return (
    <div className="flex flex-col gap-3">
      {hasData ? (
        <p className="text-[15px] font-semibold text-foreground">
          <span className="text-primary">{peak.label}요일</span>에 가장 많이 써요{' '}
          <span className="text-[13px] font-medium text-muted-foreground">(하루 평균 {formatWon(peak.average)})</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">아직 요일 패턴을 볼 만큼 지출이 없어요</p>
      )}
      <div className="h-[176px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="label"
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tickLine={false}
              tick={{ ...AXIS_TICK, fontSize: 12 }}
              height={24}
            />
            <YAxis
              width={40}
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              tickCount={3}
              allowDecimals={false}
              tickFormatter={(v: number) => (v === 0 ? '0' : formatCompactWon(v))}
            />
            <Tooltip
              cursor={{ fill: 'var(--viz-grid)' }}
              content={({ active, payload }) => {
                const p = active && payload?.[0] ? (payload[0].payload as WeekdayPoint) : null;
                if (!p) return null;
                return (
                  <ChartTooltipBox
                    title={`${p.label}요일 · ${p.days}일 기준`}
                    rows={[{ key: 'avg', label: '하루 평균', value: formatWon(p.average), color: 'var(--viz-1)' }]}
                    footer={`합계 ${formatWon(p.total)}`}
                  />
                );
              }}
            />
            <Bar dataKey="average" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((p) => (
                <Cell key={p.weekday} fill={p === peak ? 'var(--viz-1)' : 'var(--viz-muted-bar)'} />
              ))}
              {/* 최고 요일에만 값 라벨 */}
              <LabelList
                dataKey="average"
                position="top"
                content={(props) => {
                  const { x, y, width, index } = props as { x?: number; y?: number; width?: number; index?: number };
                  if (index === undefined || data[index] !== peak || x === undefined || y === undefined) return null;
                  return (
                    <text
                      x={Number(x) + Number(width ?? 0) / 2}
                      y={Number(y) - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={700}
                      fill="var(--foreground)"
                    >
                      {formatCompactWon(peak!.average)}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>요일별 하루 평균 지출</caption>
        <thead>
          <tr>
            <th scope="col">요일</th>
            <th scope="col">하루 평균</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.weekday}>
              <th scope="row">{p.label}요일</th>
              <td>{formatWon(p.average)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
