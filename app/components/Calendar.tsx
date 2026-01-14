'use client';

import { useState, useMemo } from 'react';
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
}

// 날짜별 거래 합계 계산
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

// 금액 포맷팅 (1000 단위)
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
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 주 시작 요일 설정
  const weekStartsOn = weekStartDay === 'sunday' ? 0 : 1;

  // 달력에 표시할 날짜 배열 생성
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
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
  }, [currentMonth, weekStartsOn]);

  // 요일 헤더
  const weekDays = useMemo(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    if (weekStartDay === 'monday') {
      return [...days.slice(1), days[0]];
    }
    return days;
  }, [weekStartDay]);

  // 월 이동
  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  return (
    <div className="flex flex-col">
      {/* 헤더: 월 네비게이션 */}
      <div className="flex items-center justify-between px-4 py-3">
        <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <button
          onClick={goToToday}
          className="text-lg font-semibold text-foreground hover:text-primary"
        >
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </button>

        <Button variant="ghost" size="icon" onClick={goToNextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`py-2 text-center text-sm font-medium ${
              index === 0 || (weekStartDay === 'monday' && index === 6)
                ? 'text-expense'
                : index === 6 || (weekStartDay === 'monday' && index === 5)
                  ? 'text-primary'
                  : 'text-muted-foreground'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const { income, expense } = getDailySummary(transactions, day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={`flex min-h-[72px] flex-col items-center border-b border-r border-border p-1 transition-colors hover:bg-accent ${
                !isCurrentMonth ? 'bg-muted/30 opacity-40' : ''
              } ${isSelected ? 'bg-primary/10' : ''}`}
            >
              {/* 날짜 */}
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  isTodayDate
                    ? 'bg-primary font-bold text-primary-foreground'
                    : isSelected
                      ? 'font-semibold text-primary'
                      : 'text-foreground'
                }`}
              >
                {format(day, 'd')}
              </span>

              {/* 수입/지출 요약 */}
              <div className="mt-1 flex flex-col items-center gap-0.5">
                {income > 0 && (
                  <span className="text-[10px] font-medium text-income">
                    +{formatAmount(income)}
                  </span>
                )}
                {expense > 0 && (
                  <span className="text-[10px] font-medium text-expense">
                    -{formatAmount(expense)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
