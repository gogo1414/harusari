'use client';

import { cn } from '@/lib/utils';

// 기본 스켈레톤 컴포넌트
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-muted/60',
        className
      )}
      {...props}
    />
  );
}

// 달력 스켈레톤
export function CalendarSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// 거래 항목 스켈레톤
export function TransactionItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3">
      <Skeleton className="h-12 w-12 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

// 거래 목록 스켈레톤
export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <TransactionItemSkeleton key={i} />
      ))}
    </div>
  );
}

// 통계 카드 스켈레톤
export function StatCardSkeleton() {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-sm">
      <Skeleton className="mb-2 h-4 w-16" />
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

// 요약 카드 스켈레톤 (홈 페이지용)
export function SummaryCardSkeleton() {
  return (
    <div className="flex gap-3">
      <div className="flex-1 rounded-3xl bg-card p-4 shadow-sm">
        <Skeleton className="mb-2 h-3 w-12" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="flex-1 rounded-3xl bg-card p-4 shadow-sm">
        <Skeleton className="mb-2 h-3 w-12" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}

// 차트 스켈레톤
export function ChartSkeleton({ type = 'donut' }: { type?: 'donut' | 'bar' }) {
  if (type === 'donut') {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Skeleton className="h-48 w-48 rounded-full" />
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  // 막대 그래프 높이 (고정값으로 변경)
  const barHeights = [60, 100, 45, 85, 70, 55];

  return (
    <div className="flex items-end justify-between gap-2 p-8">
      {barHeights.map((height, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <Skeleton
            className="w-full rounded-t-lg"
            style={{ height: `${height}px` }}
          />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

// 카테고리 그리드 스켈레톤
export function CategoryGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 gap-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

// 페이지 로딩 스켈레톤
export function PageSkeleton() {
  return (
    <div className="min-h-dvh space-y-6 p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-6 w-32" />
      </div>

      {/* 콘텐츠 */}
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </div>
    </div>
  );
}
