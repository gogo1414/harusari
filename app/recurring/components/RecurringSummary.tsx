'use client';

interface RecurringSummaryProps {
  stats: {
    income: number;
    expense: number;
  };
}

export default function RecurringSummary({ stats }: RecurringSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <div className="rounded-[24px] bg-card p-4 sm:p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[100px] sm:h-[110px] relative overflow-hidden">
         <div className="absolute top-0 right-0 p-4 opacity-10">
           <span className="text-3xl sm:text-4xl text-income">↘</span>
         </div>
         <p className="text-xs sm:text-sm font-medium text-muted-foreground">고정 수입 (월)</p>
         <p className="text-[clamp(18px,5vw,24px)] font-extrabold tracking-tight truncate w-full">
           <span className="text-income">+</span>
           <span className="text-foreground">{stats.income.toLocaleString()}</span>
         </p>
      </div>

      <div className="rounded-[24px] bg-card p-4 sm:p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[100px] sm:h-[110px] relative overflow-hidden">
         <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="text-3xl sm:text-4xl text-expense">↗</span>
         </div>
         <p className="text-xs sm:text-sm font-medium text-muted-foreground">고정 지출 (월)</p>
         <p className="text-[clamp(18px,5vw,24px)] font-extrabold tracking-tight truncate w-full">
           <span className="text-expense">-</span>
           <span className="text-foreground">{stats.expense.toLocaleString()}</span>
         </p>
      </div>
    </div>
  );
}
