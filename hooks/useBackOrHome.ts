'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

/**
 * 이 탭에서 앱 안의 화면 이동이 몇 번 있었는지 (모듈 상태 — 새로고침하면 초기화).
 * window.history.length는 앱 밖의 이전 페이지(about:blank, 다른 사이트)도 세기 때문에
 * 딥링크로 들어온 경우를 구분할 수 없다.
 */
let inAppNavigations = 0;
let lastPathname: string | null = null;

/** 앱 루트(Providers)에서 한 번 호출해 화면 이동을 기록한다 */
export function useTrackInAppNavigation() {
  const pathname = usePathname();
  useEffect(() => {
    if (lastPathname !== null && lastPathname !== pathname) inAppNavigations += 1;
    lastPathname = pathname;
  }, [pathname]);
}

/**
 * 뒤로 가기. 단, 알림/딥링크로 앱에 직접 진입해 앱 안 이전 화면이 없으면
 * router.back()이 앱 밖(브라우저 이전 페이지)으로 이탈하므로 fallback 경로로 이동한다.
 */
export function useBackOrHome(fallback: string = '/') {
  const router = useRouter();
  return useCallback(() => {
    if (inAppNavigations > 0) {
      router.back();
    } else {
      router.replace(fallback);
    }
  }, [router, fallback]);
}
