import { OptionCardWithSwitch } from '@/components/common/OptionCard';
import ToggleButton from '@/components/common/ToggleButton';
import { Repeat as RepeatIcon, CalendarIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TransactionRecurringOptionProps {
  isRecurring: boolean;
  onRecurringChange: (val: boolean) => void;
  isRecurringFixed: boolean;
  endType: 'never' | 'date';
  onEndTypeChange: (val: 'never' | 'date') => void;
  endDate: Date | undefined;
  onEndDateChange: (date: Date | undefined) => void;
}

export default function TransactionRecurringOption({
  isRecurring,
  onRecurringChange,
  isRecurringFixed,
  endType,
  onEndTypeChange,
  endDate,
  onEndDateChange,
}: TransactionRecurringOptionProps) {
  return (
    <OptionCardWithSwitch
      icon={RepeatIcon}
      title="반복 설정"
      description="매월 자동으로 기록할까요?"
      active={isRecurring}
      checked={isRecurring}
      onCheckedChange={isRecurringFixed ? () => {} : onRecurringChange}
      disabled={isRecurringFixed}
    >
      {isRecurring && (
        <div className="pt-2 pl-1 space-y-4 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-background rounded-2xl p-4 shadow-sm">
            <Label className="text-xs text-muted-foreground mb-3 block font-bold">종료일</Label>
            <ToggleButton.Group
              value={endType}
              onChange={(val) => onEndTypeChange(val as 'never' | 'date')}
              className="mb-3"
            >
              <ToggleButton value="never" className="flex-1 py-3 text-sm">계속 반복</ToggleButton>
              <ToggleButton value="date" className="flex-1 py-3 text-sm">날짜 지정</ToggleButton>
            </ToggleButton.Group>

            {endType === 'date' && (
              <div className="mt-3 animate-in fade-in pt-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-center font-medium h-12 rounded-xl bg-muted/30 border-none hover:bg-muted/50",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                      {endDate ? format(endDate, "yyyy년 M월 d일", { locale: ko }) : <span>종료일 선택</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-none" align="center">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => onEndDateChange(d)}
                      disabled={(d) => d < new Date()}
                      initialFocus
                      className="rounded-2xl"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      )}
    </OptionCardWithSwitch>
  );
}
