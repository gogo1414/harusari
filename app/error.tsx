'use client';

import { useEffect } from 'react';
import QueryErrorState from '@/components/common/QueryErrorState';

/**
 * 루트 에러 바운더리.
 * 렌더/데이터 로직에서 발생한 예외를 잡아 흰 화면 대신 재시도 UI를 보여준다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error boundary:', error);
  }, [error]);

  return (
    <div className="bg-background">
      <QueryErrorState
        fullHeight
        message="문제가 발생했어요"
        onRetry={reset}
      />
    </div>
  );
}
