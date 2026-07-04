'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * 뒤로 가기. 단, 알림/딥링크로 앱에 직접 진입해 히스토리가 없는 경우
 * router.back()이 앱 밖(브라우저 이전 사이트)으로 이탈하므로 홈으로 fallback한다.
 */
export function useBackOrHome(fallback: string = '/') {
  const router = useRouter();
  return useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, fallback]);
}
