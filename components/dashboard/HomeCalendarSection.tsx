'use client';

import { useSyncExternalStore } from 'react';
import { AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import Calendar from '@/components/calendar/Calendar';
import { CalendarSkeleton, SummaryCardSkeleton } from '@/components/common/Skeleton';
import DailyTransactionCard from '@/components/common/DailyTransactionCard';
import SummaryCard from '@/components/common/SummaryCard';
import { AnimatedCurrency } from '@/components/animation/AnimatedNumber';
import { getCycleRange } from '@/lib/date';
import DailySurvivalCard from '@/components/dashboard/DailySurvivalCard';
import type { Transaction, Category } from '@/types/database'; // Import types

// 마운트 여부: 서버/하이드레이션 렌더에서는 false, 이후 클라이언트 렌더에서는 true
const subscribeNoop = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

interface HomeCalendarSectionProps {
  isLoading: boolean;
  transactions: Transaction[];
  cycleTransactions: Transaction[]; // New prop
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
  cycleTransactions, // Destructure
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
    const cycleRange = getCycleRange(currentDate, cycleStartDay);
    // 사이클 중간점 기준으로 라벨 월을 계산해 Calendar 헤더와 일관되게 표시
    const cycleLabelDate = new Date((cycleRange.start.getTime() + cycleRange.end.getTime()) / 2);
    // 홈은 빌드 시 정적 프리렌더되므로 new Date() 기반 월 라벨을 서버 HTML에 넣으면
    // 빌드 시점 월과 현재 월이 다를 때 하이드레이션 불일치가 난다 → 마운트 후에만 표시
    const isMounted = useSyncExternalStore(subscribeNoop, getMountedSnapshot, getServerMountedSnapshot);

  return (
    <div className="flex-1 px-4 pt-4 pb-24">
      {/* Daily Survival Widget */}
      <div className="mb-4">
        <DailySurvivalCard 
          currentDate={currentDate}
          transactions={cycleTransactions}
          cycleEndDate={cycleRange.end}
        />
      </div>

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
          {isMounted && (
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
               {format(cycleLabelDate, 'M월')}
            </span>
          )}
        </h2>
        {isLoading ? (
          <SummaryCardSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <SummaryCard type="income" interactive={false}>
              <SummaryCard.Badge type="income">↘</SummaryCard.Badge>
              <SummaryCard.Label>수입</SummaryCard.Label>
              <SummaryCard.Amount type="income" prefix="+">
                <AnimatedCurrency value={monthlyStats.income} type="income" />
              </SummaryCard.Amount>
            </SummaryCard>

            <SummaryCard type="expense" interactive={false}>
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
