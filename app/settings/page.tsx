'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Moon, Sun, Monitor, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/types/database';

type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update'];

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  // 사용자 설정 조회
  const { data: userSettings, isLoading: isSettingsLoading } = useQuery({
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

  // 설정 업데이트 Mutation
  const settingsMutation = useMutation({
    mutationFn: async (updates: UserSettingsUpdate) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_settings')
        // @ts-expect-error - upsert 타입 불일치
        .upsert({ user_id: user.id, ...updates });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_settings'] });
    },
  });

  const handleCycleChange = (value: string) => {
    settingsMutation.mutate({ cycle_start_day: parseInt(value) });
  };

  const handleWeekStartChange = (value: string) => {
    settingsMutation.mutate({ week_start: value === '1' ? 'monday' : 'sunday' });
  };

  if (!mounted || isSettingsLoading) {
    return (
       <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background p-4 pb-20 font-sans">
      <div className="mb-6 flex items-center gap-2 sticky top-0 bg-background/80 backdrop-blur-md z-10 py-2 -mx-4 px-4 border-b border-black/5 dark:border-white/5">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 rounded-full h-10 w-10">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-extrabold tracking-tight">환경 설정</h1>
      </div>

      <div className="space-y-8">
        {/* 테마 설정 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground ml-3 mb-2 uppercase tracking-wider">테마</h2>
          <div className="grid grid-cols-3 gap-3">
             <button
               onClick={() => setTheme('light')}
               className={`flex flex-col items-center justify-center gap-3 h-24 rounded-[20px] border transition-all ${theme === 'light' ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-card border-border/80 text-muted-foreground hover:bg-muted/50 ring-1 ring-border/60'}`}
             >
               <Sun className="h-6 w-6" />
               <span className="text-xs font-bold">라이트</span>
             </button>
             <button
               onClick={() => setTheme('dark')}
               className={`flex flex-col items-center justify-center gap-3 h-24 rounded-[20px] border transition-all ${theme === 'dark' ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-card border-border/80 text-muted-foreground hover:bg-muted/50 ring-1 ring-border/60'}`}
             >
               <Moon className="h-6 w-6" />
               <span className="text-xs font-bold">다크</span>
             </button>
             <button
               onClick={() => setTheme('system')}
               className={`flex flex-col items-center justify-center gap-3 h-24 rounded-[20px] border transition-all ${theme === 'system' ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-card border-border/80 text-muted-foreground hover:bg-muted/50 ring-1 ring-border/60'}`}
             >
               <Monitor className="h-6 w-6" />
               <span className="text-xs font-bold">시스템</span>
             </button>
          </div>
        </section>

        {/* 앱 설정 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground ml-3 mb-2 uppercase tracking-wider">기본 설정</h2>
          <div className="rounded-[24px] bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5 overflow-hidden divide-y divide-black/5 dark:divide-white/5">
            <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div className="flex flex-col gap-0.5">
                <Label className="text-base font-bold">급여 사이클 시작일</Label>
                <span className="text-xs text-muted-foreground">달력/통계 기준일</span>
              </div>
              <Select 
                value={userSettings?.cycle_start_day?.toString() || '1'} 
                onValueChange={handleCycleChange}
              >
                <SelectTrigger className="w-[110px] h-9 rounded-full bg-muted/50 border-none font-semibold">
                  <SelectValue placeholder="날짜 선택" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()} className="rounded-lg">
                      매월 {day}일
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div className="flex flex-col gap-0.5">
                <Label className="text-base font-bold">주 시작 요일</Label>
                <span className="text-xs text-muted-foreground">달력 표시 방식</span>
              </div>
              <Select 
                value={userSettings?.week_start === 'monday' ? '1' : '0'} 
                onValueChange={handleWeekStartChange}
              >
                <SelectTrigger className="w-[110px] h-9 rounded-full bg-muted/50 border-none font-semibold">
                  <SelectValue placeholder="요일 선택" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="0" className="rounded-lg">일요일</SelectItem>
                  <SelectItem value="1" className="rounded-lg">월요일</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* 알림 설정 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground ml-3 mb-2 uppercase tracking-wider">알림</h2>
          <div className="rounded-[24px] bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
             <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold text-foreground">알림 허용</Label>
                  <div className="text-xs text-muted-foreground">
                    정해진 시간에 작성 알림을 받습니다
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full px-4 h-9 font-bold bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={() => {
                    if ('Notification' in window) {
                      Notification.requestPermission().then((permission) => {
                        if (permission === 'granted') {
                          new Notification('알림이 설정되었습니다', {
                            body: '하루살이에서 알림을 보낼 수 있습니다.',
                            icon: '/icons/icon-192.png'
                          });
                        }
                      });
                    } else {
                      alert('이 브라우저는 알림을 지원하지 않습니다.');
                    }
                  }}
                >
                  켜기
                </Button>
             </div>
          </div>
        </section>

        <section className="pt-8 pb-4">
          <div className="flex flex-col items-center justify-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold">하루살이 v0.1.0</p>
            <p>© 2024 Harusari. All rights reserved.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
