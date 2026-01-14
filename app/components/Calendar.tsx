'use client';

import { useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Transaction } from '@/types/database';

interface CalendarProps {
  transactions: Transaction[];
  cycleStartDay?: number;
  weekStartDay?: 'sunday' | 'monday';
  onDateSelect: (date: Date) => void;
  selectedDate?: Date;
  currentDate: Date;
  onMonthChange: (date: Date) => void;
}

function getDailySummary(transactions: Transaction[], date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayTransactions = transactions.filter((t) => t.date === dateStr);

  const income = dayTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = dayTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return { income, expense };
}

function formatAmount(amount: number) {
  if (amount >= 10000) {
    return `${Math.floor(amount / 10000)}만`;
  }
  if (amount >= 1000) {
    return `${Math.floor(amount / 1000)}천`;
  }
  return amount.toString();
}

export default function Calendar({
  transactions,
  cycleStartDay = 1,
  weekStartDay = 'sunday',
  onDateSelect,
  selectedDate,
  currentDate,
  onMonthChange,
}: CalendarProps) {
  const weekStartsOn = weekStartDay === 'sunday' ? 0 : 1;

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });

    const days: Date[] = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  }, [currentDate, weekStartsOn]);

  const weekDays = useMemo(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    if (weekStartDay === 'monday') {
      return [...days.slice(1), days[0]];
    }
    return days;
  }, [weekStartDay]);

  const goToPreviousMonth = () => onMonthChange(subMonths(currentDate, 1));
  const goToNextMonth = () => onMonthChange(addMonths(currentDate, 1));
  const goToToday = () => {
    const today = new Date();
    onMonthChange(today);
    onDateSelect(today);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between py-2 mb-2">
        <Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="h-8 w-8 rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </Button>

        <button
          onClick={goToToday}
          className="text-lg font-bold text-foreground hover:text-primary transition-colors"
        >
          {format(currentDate, 'yyyy년 M월', { locale: ko })}
        </button>

        <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8 rounded-full hover:bg-muted">
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-semibold ${
              index === 0 || (weekStartDay === 'monday' && index === 6)
                ? 'text-expense/80'
                : index === 6 || (weekStartDay === 'monday' && index === 5)
                  ? 'text-primary/80'
                  : 'text-muted-foreground'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {calendarDays.map((day) => {
          const { income, expense } = getDailySummary(transactions, day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <div key={day.toISOString()} className="flex justify-center h-[76px]">
            <button
              onClick={() => onDateSelect(day)}
              className={`relative flex w-full flex-col items-center pt-2 transition-all rounded-xl ${
                !isCurrentMonth ? 'opacity-30' : ''
              } ${isSelected ? 'bg-primary/10 ring-1 ring-primary ring-inset' : 'hover:bg-muted/30'}`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-all ${
                  isTodayDate
                    ? 'bg-primary font-bold text-primary-foreground shadow-sm'
                    : isSelected
                      ? 'font-bold text-primary'
                      : 'text-foreground/80 font-medium'
                }`}
              >
                {format(day, 'd')}
              </span>

              <div className="mt-1 flex flex-col items-center gap-0.5 w-full px-0.5">
                {income > 0 && (
                  <span className="truncate w-full text-center text-[10px] font-semibold text-income">
                    +{formatAmount(income)}
                  </span>
                )}
                {expense > 0 && (
                  <span className="truncate w-full text-center text-[10px] font-semibold text-expense">
                    -{formatAmount(expense)}
                  </span>
                )}
                {/* 내역 없을 때 점 표시 (선택사항) */}
                {income === 0 && expense === 0 && (
                   <span className="h-[2px]" />
                )}
              </div>
            </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
