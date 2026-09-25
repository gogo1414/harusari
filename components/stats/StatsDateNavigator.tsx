import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StatsDateNavigatorProps {
  currentCycle: { start: Date; end: Date };
  onMonthChange: (delta: number) => void;
}

/** 급여 사이클 이동 (라벨 = 사이클 종료일이 속한 월) */
export default function StatsDateNavigator({ currentCycle, onMonthChange }: StatsDateNavigatorProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onMonthChange(-1)}
        aria-label="이전 사이클"
        className="h-11 w-11 rounded-full text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="flex flex-col items-center" aria-live="polite">
        <h2 className="text-lg font-bold tracking-tight">{format(currentCycle.end, 'yyyy년 M월', { locale: ko })}</h2>
        <p className="text-xs font-medium tabular-nums text-muted-foreground">
          {format(currentCycle.start, 'M.d', { locale: ko })} ({format(currentCycle.start, 'EEE', { locale: ko })}) ~{' '}
          {format(currentCycle.end, 'M.d', { locale: ko })} ({format(currentCycle.end, 'EEE', { locale: ko })})
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onMonthChange(1)}
        aria-label="다음 사이클"
        className="h-11 w-11 rounded-full text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
