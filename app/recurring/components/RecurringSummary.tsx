'use client';

interface RecurringSummaryProps {
  stats: {
    income: number;
    expense: number;
    savings: number;
  };
}

export default function RecurringSummary({ stats }: RecurringSummaryProps) {
  // 가용액 = 월 수입 − 고정 지출 − 저축
  const available = stats.income - stats.expense - stats.savings;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[20px] bg-card p-3 sm:p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[92px] sm:h-[100px]">
          <p className="text-xs font-medium text-muted-foreground">고정 수입</p>
          <p className="text-[clamp(14px,4vw,20px)] font-extrabold tracking-tight truncate w-full">
            <span className="text-income">+</span>
            <span className="text-foreground">{stats.income.toLocaleString()}</span>
          </p>
        </div>

        <div className="rounded-[20px] bg-card p-3 sm:p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[92px] sm:h-[100px]">
          <p className="text-xs font-medium text-muted-foreground">고정 지출</p>
          <p className="text-[clamp(14px,4vw,20px)] font-extrabold tracking-tight truncate w-full">
            <span className="text-expense">-</span>
            <span className="text-foreground">{stats.expense.toLocaleString()}</span>
          </p>
        </div>

        <div className="rounded-[20px] bg-card p-3 sm:p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[92px] sm:h-[100px]">
          <p className="text-xs font-medium text-muted-foreground">🏦 저축</p>
          <p className="text-[clamp(14px,4vw,20px)] font-extrabold tracking-tight truncate w-full">
            <span className="text-primary">{stats.savings.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* 가용액 = 수입 − 고정 지출 − 저축 */}
      <div className="rounded-[20px] bg-muted/40 p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">가용액 (수입 − 고정 지출 − 저축)</span>
        <span
          className={`text-lg font-extrabold tracking-tight ${
            available < 0 ? 'text-expense' : 'text-foreground'
          }`}
        >
          {available.toLocaleString()}원
        </span>
      </div>
    </div>
  );
}
