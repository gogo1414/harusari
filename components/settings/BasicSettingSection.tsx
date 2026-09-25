'use client';

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from 'react';
import { useUserSettings } from '@/app/context/UserSettingsContext';
import { showToast } from '@/lib/toast';

type SavingField = 'cycle' | 'weekStart' | null;

export default function BasicSettingSection() {
  const { settings, updateSettings, isLoading } = useUserSettings();
  // 저장 중에는 해당 Select를 비활성화해 연속 변경으로 인한 요청 경합을 막는다
  const [savingField, setSavingField] = useState<SavingField>(null);
  const isDisabled = isLoading || savingField !== null;

  const save = async (field: Exclude<SavingField, null>, patch: Parameters<typeof updateSettings>[0]) => {
    setSavingField(field);
    try {
      await updateSettings(patch);
      showToast.success('설정이 저장되었습니다');
    } catch (error) {
      console.error('Settings save error:', error);
      const message = error instanceof Error && error.message === '로그인이 필요합니다'
        ? '로그인이 필요합니다. 다시 로그인해 주세요'
        : '설정 저장에 실패했습니다';
      showToast.error(message);
    } finally {
      setSavingField(null);
    }
  };

  const handleCycleChange = (value: string) => {
    const day = parseInt(value, 10);
    if (!Number.isInteger(day) || day < 1 || day > 31) return;
    void save('cycle', { salary_cycle_date: day });
  };

  const handleWeekStartChange = (value: string) => {
    void save('weekStart', { week_start_day: value === '1' ? 1 : 0 });
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground ml-3 mb-2 uppercase tracking-wider">기본 설정</h2>
      <div className="rounded-[24px] bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5 overflow-hidden divide-y divide-black/5 dark:divide-white/5">
        <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
          <div className="flex flex-col gap-0.5">
            <Label className="text-base font-bold">급여 사이클 시작일</Label>
            <span className="text-xs text-muted-foreground">달력/통계 기준일</span>
          </div>
          <Select 
            value={settings?.salary_cycle_date?.toString() || '1'} 
            onValueChange={handleCycleChange}
            disabled={isDisabled}
          >
            <SelectTrigger className="w-[110px] h-9 rounded-full bg-muted/50 border-none font-semibold" aria-busy={savingField === 'cycle'}>
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
            value={settings?.week_start_day === 1 ? '1' : '0'} 
            onValueChange={handleWeekStartChange}
            disabled={isDisabled}
          >
            <SelectTrigger className="w-[110px] h-9 rounded-full bg-muted/50 border-none font-semibold" aria-busy={savingField === 'weekStart'}>
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
  );
}
