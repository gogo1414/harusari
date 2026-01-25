'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  // 현재 사용자 확인
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, [supabase]);

  // 1. 설정 조회
  const { data: settings = DEFAULT_SETTINGS, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['user_settings', userId],
    queryFn: async () => {
      if (!userId) return DEFAULT_SETTINGS;
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).single();
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

  // 2. 카테고리 조회 및 자동 복구
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('created_at');
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!userId,
  });

  // 3. 카테고리가 0개일 경우 자동 생성 (한 번만 실행)
  useEffect(() => {
    if (userId && !isCategoriesLoading && categories.length === 0) {
      // 기본 카테고리 삽입 로직
      const defaultCategories = [
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
      ];

      (async () => {
        const { error } = await supabase.from('categories').insert(
          // @ts-expect-error - 기본 카테고리 타입 불일치
          defaultCategories.map((c, index) => ({ 
            user_id: userId, 
            ...c,
            sort_order: index // 기본 순서 부여 (0부터 시작)
          }))
        );
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['categories'] });
        }
      })();
    }
  }, [userId, categories.length, isCategoriesLoading, supabase, queryClient]);


  // 설정 업데이트 함수
  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!userId) return;

    // DB 페이로드 구성
    const dbPayload: UserSettingsUpdate = {};
    if (newSettings.salary_cycle_date !== undefined) dbPayload.cycle_start_day = newSettings.salary_cycle_date;
    if (newSettings.week_start_day !== undefined) dbPayload.week_start = newSettings.week_start_day === 1 ? 'monday' : 'sunday';
    
    dbPayload.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('user_settings')
      // @ts-expect-error - upsert type inference mismatch
      .upsert({ 
          user_id: userId, 
          ...dbPayload 
      }, { onConflict: 'user_id' });

    if (error) {
        console.error('Settings update error:', error);
        throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['user_settings'] });
  };

  return (
    <UserSettingsContext.Provider value={{ 
      settings, 
      categories, 
      updateSettings, 
      isLoading: isSettingsLoading || isCategoriesLoading 
    }}>
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
