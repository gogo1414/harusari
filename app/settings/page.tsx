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

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();

  useEffect(() => {
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
      return data || { week_start_day: 0, salary_cycle_date: 1 };
    },
  });

  // 설정 업데이트 Mutation
  const settingsMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, ...updates } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_settings'] });
    },
  });

  const handleCycleChange = (value: string) => {
    settingsMutation.mutate({ salary_cycle_date: parseInt(value) });
  };

  const handleWeekStartChange = (value: string) => {
    settingsMutation.mutate({ week_start_day: parseInt(value) });
  };

  if (!mounted || isSettingsLoading) {
    return (
       <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background p-4 pb-20">
      <div className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">환경 설정</h1>
      </div>

      <div className="space-y-8">
        {/* 테마 설정 */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">테마 설정</h2>
          <div className="grid grid-cols-3 gap-3">
             <Button
               variant={theme === 'light' ? 'default' : 'outline'}
               onClick={() => setTheme('light')}
               className="flex flex-col gap-2 h-20 rounded-xl"
             >
               <Sun className="h-6 w-6" />
               <span className="text-xs">라이트</span>
             </Button>
             <Button
               variant={theme === 'dark' ? 'default' : 'outline'}
               onClick={() => setTheme('dark')}
               className="flex flex-col gap-2 h-20 rounded-xl"
             >
               <Moon className="h-6 w-6" />
               <span className="text-xs">다크</span>
             </Button>
             <Button
               variant={theme === 'system' ? 'default' : 'outline'}
               onClick={() => setTheme('system')}
               className="flex flex-col gap-2 h-20 rounded-xl"
             >
               <Monitor className="h-6 w-6" />
               <span className="text-xs">시스템</span>
             </Button>
          </div>
        </section>

        {/* 앱 설정 */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">앱 설정</h2>
          
          <div className="space-y-2">
            <Label>급여 사이클 시작일</Label>
            <div className="text-sm text-muted-foreground mb-2">
              달력과 통계가 이 날짜를 기준으로 표시됩니다.
            </div>
            <Select 
              value={userSettings?.salary_cycle_date?.toString() || '1'} 
              onValueChange={handleCycleChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="날짜 선택" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    매월 {day}일
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>주 시작 요일</Label>
            <Select 
              value={userSettings?.week_start_day?.toString() || '0'} 
              onValueChange={handleWeekStartChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="요일 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">일요일</SelectItem>
                <SelectItem value="1">월요일</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* 알림 설정 */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">알림 설정</h2>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">알림 허용</Label>
              <div className="text-sm text-muted-foreground">
                매일 정해진 시간에 가계부 작성을 알려드립니다.
              </div>
            </div>
            <Button
              variant="outline"
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
              알림 켜기
            </Button>
          </div>
        </section>

        <section className="pt-4">
          <div className="rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground text-center">
            <p>하루살이 v0.1.0</p>
            <p className="mt-1">Copyright © 2024 Harusari</p>
          </div>
        </section>
      </div>
    </div>
  );
}
