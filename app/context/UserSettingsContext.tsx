'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/lib/toast';
import type { Database } from '@/types/database';

type UserSettingsRow = Database['public']['Tables']['user_settings']['Row'];
type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update'];
type Category = Database['public']['Tables']['categories']['Row'];

interface UserSettings {
  salary_cycle_date: number;
  week_start_day: number; // 0: Sunday, 1: Monday
}

interface UserSettingsContextType {
  settings: UserSettings;
  categories: Category[];
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  isLoading: boolean;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: UserSettings = {
  salary_cycle_date: 1, // 기본값: 매월 1일
  week_start_day: 0,    // 기본값: 일요일
};

const DEFAULT_CATEGORIES = [
  { name: '식비', type: 'expense', icon: 'food', is_default: true },
  { name: '교통', type: 'expense', icon: 'transport', is_default: true },
  { name: '주거', type: 'expense', icon: 'home', is_default: true },
  { name: '통신', type: 'expense', icon: 'phone', is_default: true },
  { name: '생활용품', type: 'expense', icon: 'shopping', is_default: true },
  { name: '의류', type: 'expense', icon: 'clothes', is_default: true },
  { name: '카페', type: 'expense', icon: 'cafe', is_default: true },
  { name: '여가', type: 'expense', icon: 'game', is_default: true },
  { name: '의료', type: 'expense', icon: 'medical', is_default: true },
  { name: '교육', type: 'expense', icon: 'education', is_default: true },
  { name: '기타', type: 'expense', icon: 'card', is_default: true },
  { name: '급여', type: 'income', icon: 'salary', is_default: true },
  { name: '부수입', type: 'income', icon: 'wallet', is_default: true },
  { name: '투자', type: 'income', icon: 'investment', is_default: true },
  { name: '용돈', type: 'income', icon: 'gift', is_default: true },
] as const;

// 인증 상태: resolved=false면 아직 세션 확인 전 (이때 userId=null은 '로그아웃'이 아니라 '모름')
interface AuthState {
  resolved: boolean;
  userId: string | null;
}

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  // createBrowserClient는 브라우저에서 싱글톤이지만, 참조 안정성을 위해 메모이제이션
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState<AuthState>({ resolved: false, userId: null });
  const userId = auth.userId;
  const lastUserIdRef = useRef<string | null>(null);

  // 현재 사용자 확인: getSession()으로 초기값을 잡고, onAuthStateChange로 이후 변화를 추적한다.
  // (예전에는 getUser()를 한 번만 호출해 일시적 실패 시 userId가 영원히 null로 남았다)
  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;

    const applyUser = (nextUserId: string | null) => {
      // 다른 사용자로 바뀌거나 로그아웃되면 이전 사용자의 캐시 데이터를 제거
      if (lastUserIdRef.current && lastUserIdRef.current !== nextUserId) {
        queryClient.clear();
      }
      lastUserIdRef.current = nextUserId;
      setAuth((prev) =>
        prev.resolved && prev.userId === nextUserId ? prev : { resolved: true, userId: nextUserId }
      );
    };

    // INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT, USER_UPDATED 모두 처리
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      receivedAuthEvent = true;
      applyUser(session?.user?.id ?? null);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        // 이미 인증 이벤트를 받았다면 그쪽이 더 최신이므로 무시
        if (!active || receivedAuthEvent) return;
        applyUser(session?.user?.id ?? null);
      })
      .catch((error) => {
        console.error('Session lookup error:', error);
        if (!active || receivedAuthEvent) return;
        // 이후 onAuthStateChange 이벤트가 오면 다시 갱신된다
        applyUser(null);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, queryClient]);

  // 1. 설정 조회
  const settingsQuery = useQuery({
    queryKey: ['user_settings', userId],
    queryFn: async () => {
      if (!userId) return DEFAULT_SETTINGS;
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;

      if (!data) return DEFAULT_SETTINGS;
      const safeData = data as unknown as UserSettingsRow;

      return {
        salary_cycle_date: safeData.cycle_start_day ?? 1,
        week_start_day: safeData.week_start === 'monday' ? 1 : 0,
      } as UserSettings;
    },
    enabled: !!userId,
  });
  const settings = settingsQuery.data ?? DEFAULT_SETTINGS;

  // 2. 카테고리 조회
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('created_at');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!userId,
  });
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  // 3. 카테고리가 0개일 경우 기본 카테고리 자동 생성
  // - 조회 '성공' 후 실제로 0개일 때만 실행 (조회 실패 시 data=undefined를 0개로 오인하던 문제 방지)
  // - 사용자별로 마운트당 최대 1회
  const seededUserIdRef = useRef<string | null>(null);
  const categoriesLoaded = categoriesQuery.isSuccess;
  const categoryCount = categoriesQuery.data?.length ?? -1;
  useEffect(() => {
    if (!userId || !categoriesLoaded || categoryCount !== 0) return;
    if (seededUserIdRef.current === userId) return;
    seededUserIdRef.current = userId;

    (async () => {
      // 캐시된 빈 목록이 로그인 전 조회 결과일 수 있으므로 서버에서 한 번 더 확인
      const { count, error: countError } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (countError) {
        console.error('Default category check error:', countError);
        return;
      }
      if ((count ?? 0) > 0) {
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        return;
      }

      const { error } = await supabase.from('categories').insert(
        // @ts-expect-error - 기본 카테고리 타입 불일치
        DEFAULT_CATEGORIES.map((c, index) => ({
          user_id: userId,
          ...c,
          sort_order: index, // 기본 순서 부여 (0부터 시작)
        }))
      );
      // 23505(unique 위반) = 다른 탭/요청이 이미 생성함 → 정상으로 간주하고 다시 조회
      if (!error || error.code === '23505') {
        queryClient.invalidateQueries({ queryKey: ['categories'] });
      } else {
        console.error('Default category insert error:', error);
      }
    })();
  }, [userId, categoriesLoaded, categoryCount, supabase, queryClient]);

  // 설정 업데이트 함수 (매 렌더 재생성 방지 위해 useCallback)
  // 실패 시 반드시 reject하여 호출부가 에러 토스트를 띄울 수 있도록 한다.
  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    if (!userId) {
      throw new Error('로그인이 필요합니다');
    }

    const currentSettings =
      queryClient.getQueryData<UserSettings>(['user_settings', userId]) ?? DEFAULT_SETTINGS;
    const newCycleDay = newSettings.salary_cycle_date;
    const cycleChanged = newCycleDay !== undefined && newCycleDay !== currentSettings.salary_cycle_date;

    // DB 페이로드 구성
    const dbPayload: UserSettingsUpdate = {};
    if (newSettings.salary_cycle_date !== undefined) dbPayload.cycle_start_day = newSettings.salary_cycle_date;
    if (newSettings.week_start_day !== undefined) dbPayload.week_start = newSettings.week_start_day === 1 ? 'monday' : 'sunday';

    dbPayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_settings')
      // @ts-expect-error - upsert type inference mismatch
      .upsert({
          user_id: userId,
          ...dbPayload
      }, { onConflict: 'user_id' })
      .select('user_id');

    if (error) {
      console.error('Settings update error:', error);
      throw error;
    }
    // RLS 등으로 반영된 행이 없으면 성공으로 보이지 않도록 실패 처리
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error('설정이 저장되지 않았습니다');
    }

    // 저장 성공 → 캐시에 즉시 반영 후 서버 값으로 재검증
    queryClient.setQueryData<UserSettings>(['user_settings', userId], (old) => ({
      ...(old ?? DEFAULT_SETTINGS),
      ...newSettings,
    }));
    queryClient.invalidateQueries({ queryKey: ['user_settings'] });

    // 급여일이 바뀌면 새 사이클 기준으로 도래한 고정 거래를 생성 (서버가 DB 설정을 읽어 멱등 처리).
    // 설정 저장 자체의 성공/실패와는 분리: 실패해도 저장은 성공으로 두고 경고만 표시 (다음 cron이 보정).
    if (cycleChanged) {
      void (async () => {
        try {
          const res = await fetch('/api/recurring/sync', { method: 'POST' });
          if (!res.ok) {
            console.error('Recurring sync failed:', res.status, await res.text().catch(() => ''));
            showToast.warning('고정 내역 반영이 지연되고 있어요. 잠시 후 자동으로 반영됩니다.');
          }
        } catch (syncError) {
          console.error('Recurring sync request error:', syncError);
          showToast.warning('고정 내역 반영이 지연되고 있어요. 잠시 후 자동으로 반영됩니다.');
        } finally {
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
        }
      })();
    }
  }, [userId, supabase, queryClient]);

  // 사용자 확인 전이거나, 로그인 사용자의 설정/카테고리를 아직 받지 못했으면 로딩.
  // (v5에서 disabled 쿼리는 isLoading=false라 사용자 미확인 상태에서 기본값이 노출되던 문제 → isPending 사용)
  const isLoading =
    !auth.resolved || (!!userId && (settingsQuery.isPending || categoriesQuery.isPending));

  // Provider value 메모이제이션: 루트 Provider라 참조가 매번 바뀌면 전 소비자가 연쇄 리렌더된다.
  const contextValue = useMemo(
    () => ({
      settings,
      categories,
      updateSettings,
      isLoading,
    }),
    [settings, categories, updateSettings, isLoading]
  );

  return (
    <UserSettingsContext.Provider value={contextValue}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
}
