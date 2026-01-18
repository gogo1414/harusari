'use client';

import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/types/database';

export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type UserSettingsInsert = Database['public']['Tables']['user_settings']['Insert'];
export type UserSettingsUpdateArg = Partial<Omit<UserSettingsInsert, 'user_id' | 'created_at' | 'updated_at'>>;

export function useUserSettings() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: userSettings, isLoading } = useQuery({
    queryKey: ['user_settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116: no rows returned
      
      // 설정이 없으면 기본값 반환
      return data || { cycle_start_day: 1, week_start: 'sunday' };
    },
  });

  const settingsMutation = useMutation({
    mutationFn: async (updates: UserSettingsUpdateArg) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const currentSettings = userSettings || { cycle_start_day: 1, week_start: 'sunday' as const };
      
      const payload: UserSettingsInsert = {
        user_id: user.id,
        cycle_start_day: updates.cycle_start_day ?? currentSettings.cycle_start_day,
        week_start: (updates.week_start ?? currentSettings.week_start) as 'sunday' | 'monday',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_settings')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(payload as any); // Type assertion to bypass 'never' inference issue with Supabase types

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_settings'] });
    },
  });

  return {
    userSettings,
    isLoading,
    updateSettings: settingsMutation.mutate,
  };
}
