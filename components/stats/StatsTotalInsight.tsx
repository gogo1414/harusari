import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsTotalInsightProps {
  /** 소비 지출 합계 (저축 제외) */
  totalExpense: number;
  /** 지난 사이클 대비 증감 */
  expenseDiff: number;
  /** 히어로 라벨 (예: '이번 사이클 지출') */
  label?: string;
  /** 보조 지표 (없으면 KPI 줄을 숨김) */
  kpis?: {
    income: number;
    savings: number;
    /** 0~1, 수입이 없으면 null */
    savingsRate: number | null;
    dailyAverage: number;
  };
}

const KRW = new Intl.NumberFormat('ko-KR');

/** 통계 화면 히어로: 총 지출 + 지난 사이클 대비 + 핵심 지표 */
export default function StatsTotalInsight({
  totalExpense,
  expenseDiff,
  label = '이번 사이클 지출',
  kpis,
}: StatsTotalInsightProps) {
  const DiffIcon = expenseDiff > 0 ? TrendingUp : expenseDiff < 0 ? TrendingDown : Minus;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <p className="text-[clamp(2.25rem,11vw,3rem)] font-extrabold leading-tight tracking-tighter text-foreground">
        {KRW.format(totalExpense)}
        <span className="ml-1 text-2xl font-bold tracking-normal text-muted-foreground">원</span>
      </p>

      {/* 지난 사이클 대비 증감 (아이콘 + 문장으로 전달, 색은 보조) */}
      <div
        className={cn(
          'mt-1 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold',
          expenseDiff > 0
            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
            : expenseDiff < 0
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'bg-secondary text-secondary-foreground'
        )}
      >
        <DiffIcon className="h-4 w-4" aria-hidden="true" />
        {expenseDiff === 0 ? (
          '지난 사이클과 지출이 같아요'
        ) : (
          <span>
            지난 사이클보다 <span className="tabular-nums">{KRW.format(Math.abs(expenseDiff))}원</span>{' '}
            {expenseDiff > 0 ? '더 썼어요' : '덜 썼어요'}
          </span>
        )}
      </div>

      {kpis && (
        <dl className="mt-4 grid w-full grid-cols-3 divide-x divide-border/60 rounded-2xl bg-card py-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-border/40">
          <Kpi label="수입" value={`${KRW.format(kpis.income)}원`} />
          <Kpi
            label="저축"
            value={`${KRW.format(kpis.savings)}원`}
            hint={kpis.savingsRate !== null && kpis.savings > 0 ? `저축률 ${Math.round(kpis.savingsRate * 100)}%` : undefined}
          />
          <Kpi label="하루 평균 지출" value={`${KRW.format(kpis.dailyAverage)}원`} />
        </dl>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 px-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="w-full truncate text-[15px] font-bold text-foreground">{value}</dd>
      {hint && <dd className="text-[11px] font-semibold text-primary">{hint}</dd>}
    </div>
  );
}
