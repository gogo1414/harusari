'use client';

import { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  setMonth,
  setYear,
  getYear,
  setDate,
  subDays,
  startOfDay,
  parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCompactCurrency } from '@/lib/format';
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
  // 문자열 포맷 비교 대신 Date 객체 비교로 변경 (더 안전함)
  const dayTransactions = transactions.filter((t) => isSameDay(parseISO(t.date), date));

  const income = dayTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = dayTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return { income, expense };
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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(getYear(currentDate));

  const weekStartsOn = weekStartDay === 'sunday' ? 0 : 1;

  // 급여 사이클 시작일 계산
  const currentCycleStart = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const startDay = cycleStartDay;

    let cycleStart: Date;

    // 급여일이 1일이 아니면 전달 급여일부터 시작
    if (1 < startDay) {
      cycleStart = setDate(subMonths(monthStart, 1), startDay);
    } else {
      cycleStart = setDate(monthStart, startDay);
    }

    return startOfDay(cycleStart);
  }, [currentDate, cycleStartDay]);

  // 급여 사이클 종료일 계산
  const currentCycleEnd = useMemo(() => {
    // 사이클 시작일로부터 1달 뒤 - 1일
    const end = subDays(addMonths(currentCycleStart, 1), 1);
    return startOfDay(end);
  }, [currentCycleStart]);

  // 달력 그리드를 급여 사이클 기준으로 생성
  const calendarDays = useMemo(() => {
    const calendarStart = startOfWeek(currentCycleStart, { weekStartsOn });
    const calendarEnd = endOfWeek(currentCycleEnd, { weekStartsOn });

    const days: Date[] = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  }, [currentCycleStart, currentCycleEnd, weekStartsOn]);

  const weekDays = useMemo(() => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    if (weekStartDay === 'monday') {
      return [...days.slice(1), days[0]];
    }
    return days;
  }, [weekStartDay]);

  const goToPreviousMonth = () => onMonthChange(subMonths(currentDate, 1));
  const goToNextMonth = () => onMonthChange(addMonths(currentDate, 1));
  
  const handleMonthSelect = (monthIndex: number) => {
    let newDate = setYear(currentDate, pickerYear);
    newDate = setMonth(newDate, monthIndex);
    onMonthChange(newDate);
    setIsPickerOpen(false);
  };

  const togglePicker = () => {
    setPickerYear(getYear(currentDate));
    setIsPickerOpen(!isPickerOpen);
  };

  return (
    <div className="flex flex-col relative min-h-[420px]">
      {/* Header */}
      <div className="flex flex-col items-center py-2 mb-4">
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="h-8 w-8 rounded-full hover:bg-muted" disabled={isPickerOpen}>
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </Button>

          <button
            onClick={togglePicker}
            className="flex items-center gap-1 text-lg font-bold text-foreground hover:bg-muted/50 px-3 py-1 rounded-full transition-colors"
          >
            {format(currentDate, 'yyyy년 M월', { locale: ko })}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
          </button>

          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8 rounded-full hover:bg-muted" disabled={isPickerOpen}>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
        {/* Cycle Range Indicator */}
        <span className="text-xs text-muted-foreground font-medium mt-1">
          {format(currentCycleStart, 'MM.dd')} ~ {format(currentCycleEnd, 'MM.dd')}
        </span>
      </div>

      {isPickerOpen ? (
        <div className="bg-card z-10 flex flex-col animate-in fade-in zoom-in-95 duration-200 pb-4">
           {/* Year Picker Header */}
           <div className="flex items-center justify-center gap-4 py-3 mb-1">
             <Button variant="ghost" size="icon" onClick={() => setPickerYear(pickerYear - 1)}>
               <ChevronLeft className="h-5 w-5" />
             </Button>
             <span className="text-xl font-bold">{pickerYear}년</span>
             <Button variant="ghost" size="icon" onClick={() => setPickerYear(pickerYear + 1)}>
               <ChevronRight className="h-5 w-5" />
             </Button>
           </div>

           {/* Month Grid */}
           <div className="grid grid-cols-3 gap-3 px-2">
             {Array.from({ length: 12 }, (_, i) => (
               <button
                 key={i}
                 onClick={() => handleMonthSelect(i)}
                 className={`py-3 rounded-xl text-base font-medium transition-colors ${
                   getYear(currentDate) === pickerYear && isSameMonth(setMonth(new Date(), i), currentDate)
                     ? 'bg-primary text-primary-foreground font-bold shadow-md'
                     : 'hover:bg-muted bg-muted/30'
                 }`}
               >
                 {i + 1}월
               </button>
             ))}
           </div>
        </div>
      ) : (
        <>
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
              
              // OLD LOGIC: const isCurrentMonth = isSameMonth(day, currentDate);
              // NEW LOGIC: Is the day within the current cycle range?
              const isActiveInCycle = day >= currentCycleStart && day <= currentCycleEnd;
              
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              
              const hasIncome = income > 0;
              const hasExpense = expense > 0;

              return (
                <div key={day.toISOString()} className="flex justify-center h-[80px]">
                  <button
                    onClick={() => onDateSelect(day)}
                    className={`relative flex w-full flex-col items-center justify-start pt-1.5 transition-all rounded-2xl ${
                      !isActiveInCycle ? 'opacity-30' : ''
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[14px] transition-all ${
                        isTodayDate
                          ? 'bg-primary font-bold text-primary-foreground shadow-md'
                          : isSelected
                            ? 'bg-foreground text-background font-bold'
                            : isActiveInCycle 
                              ? 'text-foreground font-medium hover:bg-muted'
                              : 'text-foreground font-normal hover:bg-muted'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>

                    {/* 일별 수입/지출 금액 표시 */}
                    <div className="mt-1 flex flex-col items-center gap-0 text-[9px] font-bold leading-tight min-h-[24px]">
                       {hasIncome && (
                         <span className="text-income whitespace-nowrap">+{formatCompactCurrency(income)}</span>
                       )}
                       {hasExpense && (
                         <span className="text-expense whitespace-nowrap">-{formatCompactCurrency(expense)}</span>
                       )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

