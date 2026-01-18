'use client';

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserSettings } from '@/hooks/useUserSettings';

export default function BasicSettingSection() {
  const { userSettings, updateSettings } = useUserSettings();

  const handleCycleChange = (value: string) => {
    updateSettings({ cycle_start_day: parseInt(value) });
  };

  const handleWeekStartChange = (value: string) => {
    updateSettings({ week_start: value === '1' ? 'monday' : 'sunday' });
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
  );
}
