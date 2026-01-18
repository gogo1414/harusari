'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationSettingSection from '@/components/settings/NotificationSettingSection';
import ThemeSettingSection from '@/components/settings/ThemeSettingSection';
import BasicSettingSection from '@/components/settings/BasicSettingSection';
import AccountSettingSection from '@/components/settings/AccountSettingSection';
import { useUserSettings } from '@/hooks/useUserSettings';

export default function SettingsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { isLoading } = useUserSettings();

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
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
        <ThemeSettingSection />

        {/* 앱 설정 */}
        <BasicSettingSection />

        {/* 알림 설정 */}
        <NotificationSettingSection />

        {/* 계정 설정 */}
        <AccountSettingSection />

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
