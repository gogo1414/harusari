'use client';

import dynamic from 'next/dynamic';
import type { SpendingMapProps } from './SpendingMap';

/** 지도 로딩 중 자리 표시 (높이 고정 → 레이아웃 흔들림 없음) */
export function SpendingMapSkeleton() {
  return (
    <div
      className="flex h-full w-full animate-pulse items-center justify-center bg-muted"
      role="status"
      aria-label="지도를 불러오는 중"
    >
      <div className="h-3 w-24 rounded-full bg-secondary" />
    </div>
  );
}

// Leaflet은 window에 의존하므로 SSR 제외
const SpendingMapLazy = dynamic<SpendingMapProps>(() => import('./SpendingMap'), {
  ssr: false,
  loading: () => <SpendingMapSkeleton />,
});

export default SpendingMapLazy;
