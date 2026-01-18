interface StatsTotalInsightProps {
  totalExpense: number;
  expenseDiff: number;
}

export default function StatsTotalInsight({
  totalExpense,
  expenseDiff,
}: StatsTotalInsightProps) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <span className="text-sm font-semibold text-muted-foreground tracking-tight">이번 달 총 지출</span>
      <h1 className="text-5xl font-extrabold tracking-tighter tabular-nums text-foreground drop-shadow-sm">
        {new Intl.NumberFormat('ko-KR').format(totalExpense)}
        <span className="text-2xl font-bold ml-1 text-muted-foreground font-sans tracking-normal">원</span>
      </h1>
      
      {/* 전월 대비 증감 배지 */}
      <div className={`mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-bold shadow-sm ring-1 ring-inset transition-all ${
        expenseDiff > 0 
          ? 'bg-red-500/10 text-red-600 ring-red-500/20' 
          : expenseDiff < 0 
            ? 'bg-blue-500/10 text-blue-600 ring-blue-500/20' 
            : 'bg-secondary text-secondary-foreground ring-black/5'
      }`}>
        {expenseDiff > 0 ? '📈' : expenseDiff < 0 ? '📉' : '➖'}
        {expenseDiff === 0 
          ? '지난달과 지출이 같아요' 
          : <span>지난달보다 <span className="tabular-nums">{new Intl.NumberFormat('ko-KR').format(Math.abs(expenseDiff))}원</span> {expenseDiff > 0 ? '더 썼어요' : '덜 썼어요'}</span>}
      </div>
    </div>
  );
}
