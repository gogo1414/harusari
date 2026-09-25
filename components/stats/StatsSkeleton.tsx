/** 통계 화면 로딩 자리 표시 (실제 레이아웃과 같은 높이로 흔들림 최소화) */
export default function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="통계를 불러오는 중">
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="h-4 w-28 animate-pulse rounded-full bg-secondary" />
        <div className="h-12 w-56 animate-pulse rounded-2xl bg-secondary" />
        <div className="h-8 w-52 animate-pulse rounded-full bg-secondary/70" />
        <div className="mt-2 h-[68px] w-full animate-pulse rounded-2xl bg-card" />
      </div>
      {[260, 360, 420].map((h) => (
        <div key={h} className="animate-pulse rounded-3xl bg-card p-5" style={{ height: h }}>
          <div className="h-5 w-32 rounded-full bg-secondary" />
          <div className="mt-2 h-3 w-48 rounded-full bg-secondary/70" />
        </div>
      ))}
    </div>
  );
}
