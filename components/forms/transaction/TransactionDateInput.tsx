'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface TransactionDateInputProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

export default function TransactionDateInput({ date, onDateChange }: TransactionDateInputProps) {
  return (
    <div className="flex justify-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "h-auto py-2 px-4 rounded-full bg-muted/30 hover:bg-muted/50 text-foreground font-medium text-base",
              !date && "text-muted-foreground"
            )}
          >
            {date ? format(date, "M월 d일 (EEE)", { locale: ko }) : <span>날짜 선택</span>}
            <CalendarIcon className="ml-2 h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-none" align="center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && onDateChange(d)}
            initialFocus
            className="rounded-2xl"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
