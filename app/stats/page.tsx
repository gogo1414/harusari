'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBackOrHome } from '@/hooks/useBackOrHome';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Transaction, Category } from '@/types/database';
import { useUserSettings } from '@/app/context/UserSettingsContext';
import { useBudgetGoals } from '@/hooks/useBudgetGoals';
import BudgetAnalysisCard, { type BudgetAnalysisItem } from '@/components/stats/BudgetAnalysisCard';
import StatSection from '@/components/charts/StatSection';
import TrendChart from '@/components/charts/TrendChart';
import CategoryDonut from '@/components/charts/CategoryDonut';
import DailySpendingChart from '@/components/charts/DailySpendingChart';
import WeekdayPatternChart from '@/components/charts/WeekdayPatternChart';
import StatsDateNavigator from '@/components/stats/StatsDateNavigator';
import StatsTotalInsight from '@/components/stats/StatsTotalInsight';
import StatsCard from '@/components/stats/StatsCard';
import StatsSkeleton from '@/components/stats/StatsSkeleton';
import SpendingPlacesSection from '@/components/stats/SpendingPlacesSection';
import QueryErrorState from '@/components/common/QueryErrorState';
import { filterByDateRange } from '@/lib/date';
import { shiftCycle, getRecentCycleRanges, parseMonthParam } from '@/lib/cycle-nav';
import { buildCategoryMap, isSavings, savingsRate } from '@/lib/savings';
import {
  buildCategorySlices,
  buildCategorySlots,
  buildDailySeries,
  buildWeekdayPattern,
} from '@/lib/stats/series';

const INCOME_COLORS = [
  '#3182F6', // Blue (Toss)
  '#33C7A2', // Mint
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
];

// 월별 추이 차트에 표시할 사이클 수 (현재 사이클 포함)
const TREND_CYCLE_COUNT = 6;

interface CycleStats {
  incomeByCat: Record<string, number>;
  expenseByCat: Record<string, number>;
  savingsByCat: Record<string, number>;
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
}

// useSearchParams는 Suspense 경계가 필요하다 (Next 빌드 시 CSR bailout 에러 방지)
export default function StatsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <StatsPageContent />
    </Suspense>
  );
}

function StatsPageContent() {
  const goBack = useBackOrHome();
  const supabase = createClient();
  const searchParams = useSearchParams();

  // ?month=yyyy-MM (월간 푸시 알림 링크): 해당 월의 사이클로 진입. 잘못된 값은 무시.
  const monthParam = searchParams.get('month');
  // ?category=<id> (DailySurvivalCard 링크): 예산 분석 카드에서 해당 카테고리를 강조
  const categoryParam = searchParams.get('category');

  const [currentDate, setCurrentDate] = useState(() => parseMonthParam(monthParam) ?? new Date());
  // 같은 페이지에서 month 쿼리만 바뀌는 경우(알림 클릭 등)에도 반영 (렌더 중 상태 조정 패턴)
  const [prevMonthParam, setPrevMonthParam] = useState(monthParam);
  if (monthParam !== prevMonthParam) {
    setPrevMonthParam(monthParam);
    const parsed = parseMonthParam(monthParam);
    if (parsed) setCurrentDate(parsed);
  }

  const { settings } = useUserSettings();
  const { budgetGoals } = useBudgetGoals();
  const cycleStartDay = settings.salary_cycle_date || 1;
  const weekStartDay = settings.week_start_day ?? 0;

  // 오늘 (자정이 지나 다시 렌더되면 갱신)
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const today = useMemo(() => parseISO(todayKey), [todayKey]);

  // 최근 N개 사이클(과거→현재). addMonths/subMonths 대신 사이클 경계로 이동해
  // 급여일 29/30/31일에서 사이클이 멈추거나 건너뛰지 않도록 한다.
  const recentCycles = useMemo(
    () => getRecentCycleRanges(currentDate, cycleStartDay, TREND_CYCLE_COUNT),
    [currentDate, cycleStartDay]
  );
  const currentCycle = recentCycles[recentCycles.length - 1];
  const lastCycle = recentCycles[recentCycles.length - 2];
  const isCurrentCycle = today >= currentCycle.start && today <= currentCycle.end;

  const handleMonthChange = (delta: number) => {
    setCurrentDate(shiftCycle(currentDate, cycleStartDay, delta));
  };

  // 카테고리 데이터 조회
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at');
      if (error) throw error;
      return data as Category[];
    },
  });
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  // 최근 6사이클 거래 한 번만 조회 → 현재/지난 사이클 통계, 추이, 요일 패턴, 지출 지도가 모두 재사용 (이중 페칭 없음)
  // select('*')에 위치 컬럼(place_name, latitude 등)도 포함된다.
  const trendStart = format(recentCycles[0].start, 'yyyy-MM-dd');
  const trendEnd = format(currentCycle.end, 'yyyy-MM-dd');

  const trendQuery = useQuery({
    // queryKey에 실제 조회 범위(trendStart/trendEnd)를 포함해야 같은 해 안에서 월 이동 시 refetch됨 (3-9)
    queryKey: ['transactions', 'trend', trendStart, trendEnd, cycleStartDay],
    queryFn: async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) throw new Error('Not authenticated');

      const { data: trans, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', data.user.id)
        .gte('date', trendStart)
        .lte('date', trendEnd);

      if (error) throw error;
      return trans as Transaction[];
    },
  });
  const trendData = useMemo(() => trendQuery.data ?? [], [trendQuery.data]);
  const isLoading = trendQuery.isLoading;
  const isError = trendQuery.isError || categoriesQuery.isError;

  // 저축 판별용 카테고리 맵
  const categoryMap = useMemo(() => buildCategoryMap(categories), [categories]);
  const excludeSavings = useCallback(
    (t: Pick<Transaction, 'type' | 'category_id'>) => isSavings(t, categoryMap),
    [categoryMap]
  );

  const currentMonthTrans = useMemo(
    () => filterByDateRange(trendData, currentCycle.start, currentCycle.end),
    [trendData, currentCycle]
  );
  const lastMonthTrans = useMemo(
    () => filterByDateRange(trendData, lastCycle.start, lastCycle.end),
    [trendData, lastCycle]
  );

  // 통계 계산: 저축을 지출에서 분리. totalExpense는 '소비 지출'(저축 제외)로 재정의.
  const calculateStats = useCallback(
    (transData: Transaction[]): CycleStats => {
      const incomeByCat: Record<string, number> = {};
      const expenseByCat: Record<string, number> = {};
      const savingsByCat: Record<string, number> = {};
      let totalIncome = 0;
      let totalExpense = 0;
      let totalSavings = 0;

      transData.forEach((t) => {
        const catId = t.category_id || 'unknown';
        if (t.type === 'income') {
          incomeByCat[catId] = (incomeByCat[catId] || 0) + t.amount;
          totalIncome += t.amount;
        } else if (isSavings(t, categoryMap)) {
          savingsByCat[catId] = (savingsByCat[catId] || 0) + t.amount;
          totalSavings += t.amount;
        } else {
          expenseByCat[catId] = (expenseByCat[catId] || 0) + t.amount;
          totalExpense += t.amount;
        }
      });

      return { incomeByCat, expenseByCat, savingsByCat, totalIncome, totalExpense, totalSavings };
    },
    [categoryMap]
  );

  const currentStats = useMemo(() => calculateStats(currentMonthTrans), [calculateStats, currentMonthTrans]);
  const lastStats = useMemo(() => calculateStats(lastMonthTrans), [calculateStats, lastMonthTrans]);
  const windowStats = useMemo(() => calculateStats(trendData), [calculateStats, trendData]);

  // 예산 분석 데이터 계산
  const budgetAnalysis: BudgetAnalysisItem[] = useMemo(
    () =>
      budgetGoals
        .filter((g) => g.category_id !== null)
        .map((goal) => {
          const spent = currentMonthTrans
            .filter((t) => t.type === 'expense' && !t.source_fixed_id && t.category_id === goal.category_id)
            .reduce((sum, t) => sum + t.amount, 0);

          // 목표 금액이 0 이하인 비정상 데이터에서 NaN/Infinity% 방지
          const percentage = goal.amount > 0 ? (spent / goal.amount) * 100 : spent > 0 ? 100 : 0;

          let status: 'safe' | 'warning' | 'danger' = 'safe';
          if (spent > goal.amount) status = 'danger';
          else if (percentage >= 80) status = 'danger';
          else if (percentage >= 50) status = 'warning';

          return {
            category_id: goal.category_id,
            categoryName: goal.category?.name || '미분류',
            categoryIcon: goal.category?.icon || 'circle',
            goal: goal.amount,
            spent,
            percentage,
            status,
          };
        })
        .sort((a, b) => b.percentage - a.percentage),
    [budgetGoals, currentMonthTrans]
  );

  // 카테고리 색: 조회 구간(최근 6사이클) 지출 순위로 고정 → 도넛·지도에서 같은 카테고리는 같은 색
  const categorySlots = useMemo(() => buildCategorySlots(windowStats.expenseByCat), [windowStats]);
  const expenseSlices = useMemo(
    () => buildCategorySlices(currentStats.expenseByCat, categories, categorySlots),
    [currentStats, categories, categorySlots]
  );

  // 차트용: 소비 지출만 (저축 제외)
  const spendingOnly = useCallback(
    (list: Transaction[]) => list.filter((t) => t.type === 'expense' && !isSavings(t, categoryMap)),
    [categoryMap]
  );
  const dailySeries = useMemo(
    () => buildDailySeries(spendingOnly(currentMonthTrans), currentCycle, today),
    [spendingOnly, currentMonthTrans, currentCycle, today]
  );
  const weekdayPattern = useMemo(
    () =>
      buildWeekdayPattern(
        spendingOnly(trendData),
        { start: recentCycles[0].start, end: currentCycle.end },
        today,
        weekStartDay
      ),
    [spendingOnly, trendData, recentCycles, currentCycle, today, weekStartDay]
  );

  // 수입/소비 지출 추이 (지출은 저축 제외 — 상단 총 지출과 같은 기준)
  const monthlyTrendStats = useMemo(
    () =>
      recentCycles.map(({ start: cycleStart, end: cycleEnd }) => {
        const stats = calculateStats(filterByDateRange(trendData, cycleStart, cycleEnd));
        return { name: format(cycleEnd, 'M월'), income: stats.totalIncome, expense: stats.totalExpense };
      }),
    [recentCycles, trendData, calculateStats]
  );

  // 수입/저축 목록 (기존 StatSection 재사용)
  const toStatList = useCallback(
    (byCat: Record<string, number>) =>
      Object.entries(byCat)
        .map(([catId, amount]) => {
          const category = categories.find((c) => c.category_id === catId);
          return { name: category?.name || '미분류', amount, icon: category?.icon || 'money', color: '' };
        })
        .sort((a, b) => b.amount - a.amount)
        .map((item, index) => ({ ...item, color: INCOME_COLORS[index % INCOME_COLORS.length] })),
    [categories]
  );
  const incomeStats = useMemo(() => toStatList(currentStats.incomeByCat), [toStatList, currentStats]);
  const savingsStats = useMemo(() => toStatList(currentStats.savingsByCat), [toStatList, currentStats]);

  const expenseDiff = currentStats.totalExpense - lastStats.totalExpense;
  const incomeDiff = currentStats.totalIncome - lastStats.totalIncome;

  // 저축률 = 저축 / 수입 (수입 0이면 null → 미표시)
  const currentSavingsRate = savingsRate(currentStats.totalSavings, currentStats.totalIncome);
  const periodLabel = isCurrentCycle ? '이번 사이클' : `${format(currentCycle.end, 'M월')} 사이클`;

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-24 font-sans">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          aria-label="뒤로 가기"
          className="-ml-2 h-11 w-11 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-bold">지출 분석</h1>
        <div className="w-11" />
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pt-4">
        {/* 사이클 이동 */}
        <StatsDateNavigator currentCycle={currentCycle} onMonthChange={handleMonthChange} />

        {isError ? (
          <QueryErrorState
            message="통계를 불러오지 못했어요"
            onRetry={() => {
              trendQuery.refetch();
              categoriesQuery.refetch();
            }}
          />
        ) : isLoading ? (
          <StatsSkeleton />
        ) : (
          <>
            {/* 히어로: 총 지출 + 핵심 지표 */}
            <StatsTotalInsight
              totalExpense={currentStats.totalExpense}
              expenseDiff={expenseDiff}
              label={`${periodLabel} 지출`}
              kpis={{
                income: currentStats.totalIncome,
                savings: currentStats.totalSavings,
                savingsRate: currentSavingsRate,
                dailyAverage: dailySeries.average,
              }}
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* 예산 분석 (?category 강조) */}
              <BudgetAnalysisCard data={budgetAnalysis} highlightCategoryId={categoryParam} />

              {/* 카테고리별 지출 */}
              <StatsCard title="카테고리별 지출" description="저축은 제외했어요" className="md:col-span-2">
                <CategoryDonut
                  slices={expenseSlices}
                  total={currentStats.totalExpense}
                  centerLabel={`${periodLabel} 지출`}
                  highlightId={categoryParam}
                />
              </StatsCard>

              {/* 어디서 썼나 (지도) */}
              <div className="md:col-span-2">
                <SpendingPlacesSection
                  cycleTransactions={currentMonthTrans}
                  recentTransactions={trendData}
                  categories={categories}
                  categorySlots={categorySlots}
                  exclude={excludeSavings}
                  isCurrentCycle={isCurrentCycle}
                  recentCycleCount={TREND_CYCLE_COUNT}
                />
              </div>

              {/* 일별 지출 */}
              <StatsCard
                title="하루하루 지출"
                description={isCurrentCycle ? '오늘까지 하루 평균과 비교해요' : '사이클 하루 평균과 비교해요'}
                className="md:col-span-2"
              >
                <DailySpendingChart series={dailySeries} />
              </StatsCard>

              {/* 요일 패턴 */}
              <StatsCard title="요일별 지출 습관" description={`최근 ${TREND_CYCLE_COUNT}사이클 · 요일별 하루 평균`}>
                <WeekdayPatternChart data={weekdayPattern} />
              </StatsCard>

              {/* 추이 */}
              <StatsCard title="수입·지출 추이" description={`최근 ${TREND_CYCLE_COUNT}사이클 · 지출은 저축 제외`}>
                <TrendChart data={monthlyTrendStats} />
              </StatsCard>

              {/* 수입 내역 */}
              <StatsCard
                title="수입 내역"
                description={
                  incomeDiff === 0
                    ? '지난 사이클과 같아요'
                    : `지난 사이클보다 ${new Intl.NumberFormat('ko-KR').format(Math.abs(incomeDiff))}원 ${incomeDiff > 0 ? '많아요' : '적어요'}`
                }
              >
                <StatSection
                  title="수입"
                  stats={incomeStats}
                  total={currentStats.totalIncome}
                  type="income"
                  diffAmount={incomeDiff}
                />
              </StatsCard>

              {/* 저축 내역 (저축 카테고리 거래가 있을 때만) */}
              {currentStats.totalSavings > 0 && (
                <StatsCard
                  title="저축 내역"
                  action={
                    currentSavingsRate !== null && (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                        저축률 {(currentSavingsRate * 100).toFixed(0)}%
                      </span>
                    )
                  }
                >
                  <StatSection
                    title="저축"
                    stats={savingsStats}
                    total={currentStats.totalSavings}
                    type="income"
                    diffAmount={0}
                  />
                </StatsCard>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
