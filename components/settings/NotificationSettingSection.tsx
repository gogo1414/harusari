'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useWebPush } from '@/hooks/useWebPush';
import { cn } from '@/lib/utils';

export default function NotificationSettingSection() {
  const { isSubscribed, isLoading, subscribe, unsubscribe } = useWebPush();

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      await subscribe();
    } else {
      await unsubscribe();
    }
  };

  return (
    <section>
      <div className="flex items-center gap-2 ml-3 mb-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          알림
        </h2>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      
      <div className="rounded-[24px] bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
        <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
          <div className="flex gap-4 items-center">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full transition-colors",
              isSubscribed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {isSubscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </div>
            <div className="space-y-0.5">
              <Label className="text-base font-bold text-foreground cursor-pointer" htmlFor="noti-switch">
                알림 받기
              </Label>
              <div className="text-xs text-muted-foreground">
                중요한 금융 일정과 기록 리마인더를 받습니다
              </div>
            </div>
          </div>
          
          <Switch
            id="noti-switch"
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={isLoading}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>
      
      <p className="mt-2 ml-4 text-[11px] text-muted-foreground/60 leading-relaxed">
        * 기기의 알림 권한 허용이 필요합니다.<br/>
        * 필요한 순간에만 스마트하게 알림을 보냅니다.
      </p>
    </section>
  );
}
