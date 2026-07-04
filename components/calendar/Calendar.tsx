'use client';

import { useMemo, useState } from 'react';
import {
  format,
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
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCompactCurrency } from '@/lib/format';
import { getCycleRange } from '@/lib/date';
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

interface DailySummary {
  income: number;
  expense: number;
}
const EMPTY_SUMMARY: DailySummary = { income: 0, expense: 0 };

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

  const weekStartsOn = weekStartDay === 'sunday' ? 0 : 1;

  // 급여 사이클 범위 계산: lib/date.ts의 getCycleRange로 통일
  // (29/30/31일 급여일의 말일 클램프 로직을 단일 소스로 사용)
  const { start: currentCycleStart, end: currentCycleEnd } = useMemo(
    () => getCycleRange(currentDate, cycleStartDay),
    [currentDate, cycleStartDay]
  );

  // 헤더에 표시할 월 라벨 기준일: 사이클의 중간점이 속한 월을 사용해
  // cycleStartDay 값에 관계없이 헤더와 그리드가 항상 일치하도록 한다.
  const cycleLabelDate = useMemo(
    () => new Date((currentCycleStart.getTime() + currentCycleEnd.getTime()) / 2),
    [currentCycleStart, currentCycleEnd]
  );

  const [pickerYear, setPickerYear] = useState(getYear(cycleLabelDate));

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

  // 일별 합계를 Map으로 1회 구축 (셀당 filter+parseISO 반복 제거).
  // transaction.date가 이미 'yyyy-MM-dd' 문자열이라 parseISO 불필요.
  const dailySummaryMap = useMemo(() => {
    const map = new Map<string, DailySummary>();
    for (const t of transactions) {
      const cur = map.get(t.date) || { income: 0, expense: 0 };
      if (t.type === 'income') cur.income += t.amount;
      else cur.expense += t.amount;
      map.set(t.date, cur);
    }
    return map;
  }, [transactions]);

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
    // 어떤 cycleStartDay(2~31) 값에서도 선택한 월의 사이클로 정확히 진입하도록
    // 월 중간일(15일)을 강제 세팅한다.
    newDate = setDate(newDate, 15);
    onMonthChange(newDate);
    setIsPickerOpen(false);
  };

  const togglePicker = () => {
    setPickerYear(getYear(cycleLabelDate));
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
            {format(cycleLabelDate, 'yyyy년 M월', { locale: ko })}
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
                   getYear(cycleLabelDate) === pickerYear && isSameMonth(setMonth(new Date(), i), cycleLabelDate)
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
              const { income, expense } = dailySummaryMap.get(format(day, 'yyyy-MM-dd')) || EMPTY_SUMMARY;
              
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

