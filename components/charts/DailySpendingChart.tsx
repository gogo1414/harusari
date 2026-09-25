'use client';

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK, ChartTooltipBox, GRID_STROKE } from '@/components/charts/ChartTooltip';
import { formatCompactWon, formatWon, type DailySeries } from '@/lib/stats/series';

interface DailySpendingChartProps {
  series: DailySeries;
}

function dayLabel(date: string) {
  return format(parseISO(date), 'M.d (EEE)', { locale: ko });
}

/**
 * 사이클 일별 지출 막대 + 일평균 기준선 + 오늘 표시.
 * 단일 계열이라 범례 없이 제목이 계열을 설명한다.
 */
export default function DailySpendingChart({ series }: DailySpendingChartProps) {
  const { points, average, maxPoint } = series;
  const todayPoint = points.find((p) => p.isToday) ?? null;
  const hasData = points.some((p) => p.amount > 0);

  // x축 눈금: 사이클 첫날, 7일 간격, 마지막 날
  // (마지막 날이 직전 눈금과 3일 이내면 겹치므로 생략)
  const ticks = points
    .filter((_, i) => i % 7 === 0 || (i === points.length - 1 && i % 7 >= 3))
    .map((p) => p.date);

  return (
    <div className="flex flex-col gap-3">
      {/* 기준선 범례 (막대 위 라벨이 겹치지 않도록 차트 밖에 표시) */}
      <ul className="flex items-center gap-4 text-xs font-medium text-muted-foreground" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="h-px w-4" style={{ backgroundColor: 'var(--viz-ink-muted)' }} />
          하루 평균 {formatCompactWon(average)}
        </li>
        {todayPoint && (
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-px bg-foreground/60" />
            오늘
          </li>
        )}
      </ul>
      <div className="relative h-[200px] w-full">
        {!hasData && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
            이 기간 지출이 없어요
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} barCategoryGap={1}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={(d: string) => `${Number(d.slice(8))}일`}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tickLine={false}
              tick={AXIS_TICK}
              interval={0}
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
                const p = active && payload?.[0] ? (payload[0].payload as DailySeries['points'][number]) : null;
                if (!p) return null;
                return (
                  <ChartTooltipBox
                    title={`${dayLabel(p.date)}${p.isToday ? ' · 오늘' : ''}`}
                    rows={[
                      {
                        key: 'amount',
                        label: p.isFuture ? '예정' : '지출',
                        value: formatWon(p.amount),
                        color: 'var(--viz-1)',
                      },
                    ]}
                  />
                );
              }}
            />
            {average > 0 && (
              <ReferenceLine
                y={average}
                stroke="var(--viz-ink-muted)"
                strokeWidth={1}
                ifOverflow="extendDomain"
              />
            )}
            {todayPoint && (
              <ReferenceLine
                x={todayPoint.date}
                stroke="var(--foreground)"
                strokeOpacity={0.6}
                strokeWidth={1}
                label={{ value: '오늘', position: 'top', fill: 'var(--foreground)', fontSize: 11, fontWeight: 700 }}
              />
            )}
            <Bar dataKey="amount" maxBarSize={16} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {points.map((p) => (
                <Cell key={p.date} fill="var(--viz-1)" fillOpacity={p.isFuture ? 0.35 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 요약 문장 (툴팁 없이도 핵심 값 확인) */}
      <p className="text-[13px] text-muted-foreground">
        하루 평균 <strong className="font-bold text-foreground">{formatWon(average)}</strong>
        {maxPoint && (
          <>
            {' · '}가장 많이 쓴 날 <strong className="font-bold text-foreground">{dayLabel(maxPoint.date)}</strong>{' '}
            {formatWon(maxPoint.amount)}
          </>
        )}
      </p>

      {/* 스크린리더용 표 */}
      <table className="sr-only">
        <caption>일별 지출</caption>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">지출</th>
          </tr>
        </thead>
        <tbody>
          {points
            .filter((p) => !p.isFuture)
            .map((p) => (
              <tr key={p.date}>
                <th scope="row">{dayLabel(p.date)}</th>
                <td>{formatWon(p.amount)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
