'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ThemeSettingSection() {
  const { theme, setTheme } = useTheme();

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground ml-3 mb-2 uppercase tracking-wider">테마</h2>
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setTheme('light')}
          className={cn(
            "flex flex-col items-center justify-center gap-3 h-24 rounded-[20px] border transition-all",
            theme === 'light' 
              ? "bg-primary/5 border-primary text-primary shadow-sm" 
              : "bg-card border-border/80 text-muted-foreground hover:bg-muted/50 ring-1 ring-border/60"
          )}
        >
          <Sun className="h-6 w-6" />
          <span className="text-xs font-bold">라이트</span>
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={cn(
            "flex flex-col items-center justify-center gap-3 h-24 rounded-[20px] border transition-all",
            theme === 'dark' 
              ? "bg-primary/5 border-primary text-primary shadow-sm" 
              : "bg-card border-border/80 text-muted-foreground hover:bg-muted/50 ring-1 ring-border/60"
          )}
        >
          <Moon className="h-6 w-6" />
          <span className="text-xs font-bold">다크</span>
        </button>
        <button
          onClick={() => setTheme('system')}
          className={cn(
            "flex flex-col items-center justify-center gap-3 h-24 rounded-[20px] border transition-all",
            theme === 'system' 
              ? "bg-primary/5 border-primary text-primary shadow-sm" 
              : "bg-card border-border/80 text-muted-foreground hover:bg-muted/50 ring-1 ring-border/60"
          )}
        >
          <Monitor className="h-6 w-6" />
          <span className="text-xs font-bold">시스템</span>
        </button>
      </div>
    </section>
  );
}
