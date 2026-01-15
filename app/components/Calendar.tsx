'use client';

import { useMemo, useState } from 'react';
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
  setMonth,
  setYear,
  getYear,
  getMonth,
  setDate,
  subDays,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(getYear(currentDate));

  const weekStartsOn = weekStartDay === 'sunday' ? 0 : 1;

  const calendarDays = useMemo(() => {
    // 1. 현재 날짜가 속한 사이클의 시작일 계산
    let cycleStartDate = setYear(setMonth(currentDate, getMonth(currentDate)), getYear(currentDate));
    
    // 만약 현재 날짜의 '일'이 cycleStartDay보다 작다면, 이전 달의 사이클에 속함
    // 예: cycleStartDay=25, currentDate=10월 5일 -> 9월 25일 시작 사이클
    // 하지만 currentDate는 이미 '보여줄 달'의 1일로 들어온다고 가정하면 (Month Navigation에서 처리)
    // 여기서는 '보여줄 달'의 사이클 시작일을 기준으로 해야 함.
    
    // currentDate가 '2026-12-01'처럼 월의 1일로 들어온다고 가정 (onMonthChange에서 그렇게 넘김)
    // 사이클 시작일은 해당 월의 cycleStartDay
    cycleStartDate = setYear(setMonth(cycleStartDate, getMonth(currentDate)), getYear(currentDate));
    cycleStartDate = setDate(cycleStartDate, cycleStartDay);

    // 만약 cycleStartDay가 1일이면 -> 12월 1일 ~ 12월 31일
    // cycleStartDay가 25일이면 -> 12월 25일 ~ 1월 24일 (이걸 '12월'로 볼 것인지 '1월'로 볼 것인지 정의 필요)
    // 통상적으로 "N월" 가계부는 "N월 급여일 ~ N+1월 급여일 전날"을 의미하는 경우가 많음.
    // 여기서는 currentDate가 가리키는 달의 cycleStartDay를 시작으로 잡음.

    const cycleEndDate = subDays(addMonths(cycleStartDate, 1), 1);

    // 달력 그리드 표시를 위한 시작/끝 날짜 (주 단위 맞춤)
    const calendarStart = startOfWeek(cycleStartDate, { weekStartsOn });
    const calendarEnd = endOfWeek(cycleEndDate, { weekStartsOn });

    const days: Date[] = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  }, [currentDate, weekStartsOn, cycleStartDay]);

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

  // 현재 보여지는 사이클의 시작일과 종료일 계산 (UI 표시 및 활성화 로직용)
  const currentCycleStart = useMemo(() => {
    // 1. 현재 보여지는 달(currentDate의 Month)의 cycleStartDay를 구함
    // 이 currentDate는 "보여지는 달"임. 
    // 하지만 "12월"이라고 표시될 때 실제로는 "11월 25일 ~ 12월 24일"인지 "12월 25일 ~ 1월 24일"인지 앱의 로직에 따라 다름.
    // 여기서는 cycleStartDay >= 20 이면 "전월 Start ~ 당월 Start-1"을 보통 씀 (카드값 등)
    // 혹은 "당월 Start ~ 익월 Start-1"을 쓰기도 함.
    // 기존 로직(위의 calendarDays)에서는 setMonth(currentDate, getMonth) -> 즉 당월 Start로 잡았음.
    // 일관성을 위해 위에서 계산한 로직과 동일하게 가져감.
    
    let start = setYear(setMonth(currentDate, getMonth(currentDate)), getYear(currentDate));
    return setDate(start, cycleStartDay);
  }, [currentDate, cycleStartDay]);

  const currentCycleEnd = useMemo(() => {
    return subDays(addMonths(currentCycleStart, 1), 1);
  }, [currentCycleStart]);

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
        <div className="absolute top-[80px] left-0 right-0 bottom-0 bg-card z-10 flex flex-col animate-in fade-in zoom-in-95 duration-200">
           {/* Year Picker Header */}
           <div className="flex items-center justify-center gap-4 py-4 mb-2">
             <Button variant="ghost" size="icon" onClick={() => setPickerYear(pickerYear - 1)}>
               <ChevronLeft className="h-5 w-5" />
             </Button>
             <span className="text-xl font-bold">{pickerYear}년</span>
             <Button variant="ghost" size="icon" onClick={() => setPickerYear(pickerYear + 1)}>
               <ChevronRight className="h-5 w-5" />
             </Button>
           </div>
           
           {/* Month Grid */}
           <div className="grid grid-cols-3 gap-4 px-4">
             {Array.from({ length: 12 }, (_, i) => (
               <button
                 key={i}
                 onClick={() => handleMonthSelect(i)}
                 className={`py-4 rounded-xl text-lg font-medium transition-colors ${
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
                <div key={day.toISOString()} className="flex justify-center h-[64px]">
                  <button
                    onClick={() => onDateSelect(day)}
                    className={`relative flex w-full flex-col items-center justify-start pt-1.5 transition-all rounded-2xl ${
                      !isActiveInCycle ? 'opacity-30' : ''
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-[15px] transition-all ${
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

                    <div className="mt-1.5 flex items-center justify-center gap-1 h-2">
                       {hasIncome && (
                         <span className="h-1.5 w-1.5 rounded-full bg-income shadow-sm" />
                       )}
                       {hasExpense && (
                         <span className="h-1.5 w-1.5 rounded-full bg-expense shadow-sm" />
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
