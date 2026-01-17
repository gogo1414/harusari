'use client';

import { AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import Calendar from '@/components/calendar/Calendar';
import { CalendarSkeleton, SummaryCardSkeleton } from '@/components/common/Skeleton';
import DailyTransactionCard from '@/components/common/DailyTransactionCard';
import SummaryCard from '@/components/common/SummaryCard';
import { AnimatedCurrency } from '@/components/animation/AnimatedNumber';
import type { Transaction, Category } from '@/types/database'; // Import types

interface HomeCalendarSectionProps {
  isLoading: boolean;
  transactions: Transaction[];
  currentDate: Date;
  setCurrentMonth: (date: Date) => void;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onEdit: (id: string) => void;
  onDeleteRequest: (id: string) => void; 
  onCloseDailyCard: () => void;
  categories: Category[];
  monthlyStats: { income: number; expense: number };
  cycleStartDay: number;
  weekStartDay: 'sunday' | 'monday'; // Literal type
}

export default function HomeCalendarSection({
  isLoading,
  transactions,
  currentDate,
  setCurrentMonth,
  selectedDate,
  onDateSelect,
  onEdit,
  onDeleteRequest,
  onCloseDailyCard,
  categories,
  monthlyStats,
  cycleStartDay,
  weekStartDay,
}: HomeCalendarSectionProps) {
    const handleTypeClick = () => {
        // Placeholder for future type filtering
        console.log("Type filter clicked"); 
    };

  return (
    <div className="flex-1 px-4 pt-4 pb-24">
      {/* Main Card */}
      <div className="rounded-[32px] bg-card p-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10 relative">
        {isLoading ? (
           <CalendarSkeleton />
        ) : (
          <Calendar
            transactions={transactions}
            onDateSelect={onDateSelect}
            selectedDate={selectedDate || undefined}
            currentDate={currentDate}
            onMonthChange={setCurrentMonth}
            weekStartDay={weekStartDay}
            cycleStartDay={cycleStartDay}
          />
        )}
      </div>

      {/* 선택 날짜 인라인 카드 */}
      <AnimatePresence>
        {selectedDate && (
          <DailyTransactionCard
            date={selectedDate}
            transactions={transactions}
            categories={categories}
            onEdit={onEdit}
            onDelete={onDeleteRequest}
            onClose={onCloseDailyCard}
          />
        )}
      </AnimatePresence>
      
      {/* 월 요약 카드 */}
      <div className="mt-6">
        <h2 className="px-2 text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          이번 달 현황
          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
             {format(currentDate, 'M월')}
          </span>
        </h2>
        {isLoading ? (
          <SummaryCardSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <SummaryCard type="income" onClick={handleTypeClick}>
              <SummaryCard.Badge type="income">↘</SummaryCard.Badge>
              <SummaryCard.Label>수입</SummaryCard.Label>
              <SummaryCard.Amount type="income" prefix="+">
                <AnimatedCurrency value={monthlyStats.income} type="income" />
              </SummaryCard.Amount>
            </SummaryCard>

            <SummaryCard type="expense" onClick={handleTypeClick}>
              <SummaryCard.Badge type="expense">↗</SummaryCard.Badge>
              <SummaryCard.Label>지출</SummaryCard.Label>
              <SummaryCard.Amount type="expense" prefix="-">
                <AnimatedCurrency value={monthlyStats.expense} type="expense" />
              </SummaryCard.Amount>
            </SummaryCard>
          </div>
        )}
      </div>
    </div>
  );
}
