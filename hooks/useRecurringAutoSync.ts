'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { requestRecurringSync } from '@/lib/recurring/client';
import { getKstTodayStr } from '@/lib/kst';

const STORAGE_KEY = 'harusari:recurring-sync-date';

/**
 * 앱(홈) 진입 시 하루 1회 고정 지출/할부 동기화.
 * GitHub Actions cron이 지연·누락·비활성화돼도 사용자가 앱을 열면 이번 사이클 회차가 채워진다.
 * 서버 로직은 멱등이라 여러 탭에서 동시에 호출돼도 중복이 생기지 않는다.
 */
export function useRecurringAutoSync(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const today = getKstTodayStr();
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === today) return;
    } catch {
      // 저장소 접근 불가(사생활 보호 모드 등) → 그냥 동기화 진행
    }

    let cancelled = false;
    requestRecurringSync()
      .then(({ created }) => {
        try {
          window.localStorage.setItem(STORAGE_KEY, today);
        } catch {
          // 무시
        }
        if (!cancelled && created > 0) {
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
        }
      })
      .catch((error) => {
        // 실패해도 cron이 다시 시도하므로 사용자에게는 알리지 않는다
        console.warn('recurring auto sync failed:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, queryClient]);
}
