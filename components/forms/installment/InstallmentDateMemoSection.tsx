import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import React from 'react';

interface InstallmentDateMemoSectionProps {
  date: Date;
  memo: string;
  onDateChange: (date: Date | undefined) => void;
  onMemoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function InstallmentDateMemoSection({
  date,
  memo,
  onDateChange,
  onMemoChange,
}: InstallmentDateMemoSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">결제 시작일</label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "w-full h-12 justify-start text-left font-normal rounded-xl text-base px-3",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "M월 d일 (EEE)", { locale: ko }) : <span>날짜 선택</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={onDateChange}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>

        <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">내용</label>
            <input
                type="text"
                value={memo}
                onChange={onMemoChange}
                placeholder="예: 아이폰 15"
                className="flex h-12 w-full rounded-xl border border-input bg-card px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
        </div>
    </div>
  );
}
