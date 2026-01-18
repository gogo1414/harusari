'use client';

import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function AccountSettingSection() {
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground ml-3 mb-2 uppercase tracking-wider">계정</h2>
      <div className="rounded-[24px] bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
         <button
           onClick={handleLogout}
           className="w-full p-4 flex items-center gap-3 text-destructive hover:bg-destructive/5 transition-colors text-left"
         >
            <LogOut className="h-5 w-5" />
            <span className="text-base font-bold">로그아웃</span>
         </button>
      </div>
    </section>
  );
}
