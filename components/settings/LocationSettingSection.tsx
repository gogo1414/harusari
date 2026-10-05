'use client';

import { useState } from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { readAutoLocationPref, writeAutoLocationPref } from '@/lib/location/autoLocationPref';

/** 새 내역 입력 시 현재 위치 자동 추가 여부 (기본 꺼짐 = 직접 선택) */
export default function LocationSettingSection() {
  // 설정 화면은 마운트 후에만 렌더되므로 localStorage를 바로 읽어도 안전
  const [autoLocation, setAutoLocation] = useState(readAutoLocationPref);

  const handleToggle = (checked: boolean) => {
    setAutoLocation(checked);
    writeAutoLocationPref(checked);
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground ml-3 mb-2 uppercase tracking-wider">
        위치
      </h2>

      <div className="rounded-[24px] bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
        <div className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
          <div className="flex gap-4 items-center">
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 shrink-0 rounded-full transition-colors',
                autoLocation ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              {autoLocation ? <MapPin className="w-5 h-5" /> : <MapPinOff className="w-5 h-5" />}
            </div>
            <div className="space-y-0.5">
              <Label className="text-base font-bold text-foreground cursor-pointer" htmlFor="auto-location-switch">
                현재 위치 자동 추가
              </Label>
              <div className="text-xs text-muted-foreground">
                {autoLocation
                  ? '새 내역을 입력할 때 현재 위치를 자동으로 채워요'
                  : '위치는 입력 화면에서 직접 선택해요'}
              </div>
            </div>
          </div>

          <Switch
            id="auto-location-switch"
            checked={autoLocation}
            onCheckedChange={handleToggle}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>

      <p className="mt-2 ml-4 text-[11px] text-muted-foreground/60 leading-relaxed">
        * 자동 추가를 켜면 기기의 위치 권한이 필요합니다.<br />
        * 이 기기에만 적용됩니다.
      </p>
    </section>
  );
}
