import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StatsDateNavigatorProps {
  currentCycle: { start: Date; end: Date };
  onMonthChange: (delta: number) => void;
}

export default function StatsDateNavigator({
  currentCycle,
  onMonthChange,
}: StatsDateNavigatorProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-4 bg-secondary/30 rounded-full px-5 py-2 hover:bg-secondary/40 transition-colors">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onMonthChange(-1)} 
          className="h-8 w-8 rounded-full hover:bg-background/50 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-bold tabular-nums tracking-wide">
          {format(currentCycle.end, 'yyyy년 M월', { locale: ko })}
        </h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onMonthChange(1)} 
          className="h-8 w-8 rounded-full hover:bg-background/50 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground font-medium">
        ({format(currentCycle.start, 'M.d')} ~ {format(currentCycle.end, 'M.d')})
      </p>
    </div>
  );
}
