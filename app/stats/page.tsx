'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBackOrHome } from '@/hooks/useBackOrHome';
import { format } from 'date-fns';
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
import StatsDateNavigator from '@/components/stats/StatsDateNavigator';
import StatsTotalInsight from '@/components/stats/StatsTotalInsight';
import { filterByDateRange } from '@/lib/date';
import { shiftCycle, getRecentCycleRanges, parseMonthParam } from '@/lib/cycle-nav';
import { buildCategoryMap, isSavings, savingsRate } from '@/lib/savings';

const INCOME_COLORS = [
  '#3182F6', // Blue (Toss)
  '#33C7A2', // Mint
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
];

const EXPENSE_COLORS = [
  '#F04452', // Red
  '#FFB800', // Yellow
  '#EC4899', // Pink
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#64748B', // Slate
];

// 월별 추이 차트에 표시할 사이클 수 (현재 사이클 포함)
const TREND_CYCLE_COUNT = 6;

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

  // 최근 N개 사이클(과거→현재). addMonths/subMonths 대신 사이클 경계로 이동해
  // 급여일 29/30/31일에서 사이클이 멈추거나 건너뛰지 않도록 한다.
  const recentCycles = getRecentCycleRanges(currentDate, cycleStartDay, TREND_CYCLE_COUNT);
  const currentCycle = recentCycles[recentCycles.length - 1];
  const lastCycle = recentCycles[recentCycles.length - 2];

  const handleMonthChange = (delta: number) => {
    setCurrentDate(shiftCycle(currentDate, cycleStartDay, delta));
  };

  // 카테고리 데이터 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('created_at');
      if (error) throw error;
      return data as Category[];
    },
  });

  // 월별 추이 데이터 조회
  // (trend 범위가 현재/지난 사이클을 모두 포함하므로 별도의 stats 쿼리 없이 trendData를 재사용해 이중 페칭 제거)
  // 조회 범위 = 추이 차트의 가장 오래된 사이클 시작 ~ 현재 사이클 종료
  const trendStart = format(recentCycles[0].start, 'yyyy-MM-dd');
  const trendEnd = format(currentCycle.end, 'yyyy-MM-dd');

  const { data: trendData = [], isLoading: isTrendLoading } = useQuery({
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

  const isLoading = isTrendLoading;

  // 저축 판별용 카테고리 맵
  const categoryMap = buildCategoryMap(categories);

  // 통계 계산: 저축을 지출에서 분리. totalExpense는 '소비 지출'(저축 제외)로 재정의.
  const calculateStats = (transData: Transaction[]) => {
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
  };

  const currentMonthTrans = filterByDateRange(trendData, currentCycle.start, currentCycle.end);
  const lastMonthTrans = filterByDateRange(trendData, lastCycle.start, lastCycle.end);

  // 예산 분석 데이터 계산
  const budgetAnalysis: BudgetAnalysisItem[] = budgetGoals
    .filter(g => g.category_id !== null)
    .map(goal => {
        const spent = currentMonthTrans
            .filter(t => 
                t.type === 'expense' && 
                !t.source_fixed_id && 
                t.category_id === goal.category_id
            )
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
            status
        };
    })
    .sort((a, b) => b.percentage - a.percentage);

  const currentStats = calculateStats(currentMonthTrans);
  const lastStats = calculateStats(lastMonthTrans);

  // 차트 데이터 생성 함수
  const processStats = (stats: Record<string, number>, colors: string[]) => Object.entries(stats)
      .map(([catId, amount]) => {
        const category = categories.find((c) => c.category_id === catId);
        return {
          name: category?.name || '미분류',
          amount,
          icon: category?.icon || 'money',
          color: '',
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .map((item, index) => ({
        ...item,
        color: colors[index % colors.length],
      }));

  const incomeStats = processStats(currentStats.incomeByCat, INCOME_COLORS);
  const expenseStats = processStats(currentStats.expenseByCat, EXPENSE_COLORS);
  const savingsStats = processStats(currentStats.savingsByCat, INCOME_COLORS);

  const expenseDiff = currentStats.totalExpense - lastStats.totalExpense;
  const incomeDiff = currentStats.totalIncome - lastStats.totalIncome;

  // 저축률 = 저축 / 수입 (수입 0이면 null → 미표시)
  const currentSavingsRate = savingsRate(currentStats.totalSavings, currentStats.totalIncome);

  // 수입/지출 추이 데이터 처리
  const monthlyTrendStats = recentCycles.map(({ start: cycleStart, end: cycleEnd }) => {
    const labelDate = cycleEnd;
    
    const monthTrans = filterByDateRange(trendData, cycleStart, cycleEnd);
    const income = monthTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    return {
      name: format(labelDate, 'M월'),
      income,
      expense,
      incomeLabel: income > 0 ? (income / 10000).toFixed(1) : '',
      expenseLabel: expense > 0 ? (expense / 10000).toFixed(1) : '',
    };
  });

  return (
    <div className="flex flex-col min-h-dvh bg-background pb-24 font-sans">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-sm px-4 py-3 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={goBack} aria-label="뒤로 가기" className="-ml-2 rounded-full h-10 w-10 hover:bg-black/5 dark:hover:bg-white/10">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <span className="text-lg font-bold">지출 분석</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 p-5 space-y-8">
        {/* 날짜 네비게이션 */}
        <StatsDateNavigator 
            currentCycle={currentCycle} 
            onMonthChange={handleMonthChange} 
        />

        {/* 메인 인사이트 섹션 (총 지출) */}
        <StatsTotalInsight 
            totalExpense={currentStats.totalExpense} 
            expenseDiff={expenseDiff} 
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100 fill-mode-backwards">
             {/* 예산 분석 카드 */}
             <BudgetAnalysisCard data={budgetAnalysis} highlightCategoryId={categoryParam} />

            {/* 지출 카드 */}
            <div className="bg-card rounded-[32px] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/40 hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-3 mb-6">
                 <div className="flex items-center justify-center h-10 w-10 rounded-full bg-destructive/10 text-destructive">
                    <span className="text-lg">💸</span>
                 </div>
                 <h3 className="text-xl font-bold tracking-tight">지출 내역</h3>
              </div>
              <StatSection 
                title="지출" 
                stats={expenseStats} 
                total={currentStats.totalExpense} 
                type="expense" 
                diffAmount={expenseDiff} 
              />
            </div>

            {/* 수입 카드 */}
            <div className="bg-card rounded-[32px] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/40 hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center gap-3 mb-6">
                 <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500/10 text-blue-500">
                    <span className="text-lg">💰</span>
                 </div>
                 <h3 className="text-xl font-bold tracking-tight">수입 내역</h3>
              </div>
              <StatSection 
                title="수입" 
                stats={incomeStats} 
                total={currentStats.totalIncome} 
                type="income" 
                diffAmount={incomeDiff} 
              />
            </div>
            
            {/* 저축 카드 (저축 카테고리 거래가 있을 때만) */}
            {currentStats.totalSavings > 0 && (
              <div className="bg-card rounded-[32px] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/40 hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                    <span className="text-lg">🏦</span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">저축 내역</h3>
                  {currentSavingsRate !== null && (
                    <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                      저축률 {(currentSavingsRate * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <StatSection
                  title="저축"
                  stats={savingsStats}
                  total={currentStats.totalSavings}
                  type="income"
                  diffAmount={0}
                />
              </div>
            )}

            {/* 월별 추이 */}
            <div className="col-span-1 md:col-span-2 bg-card rounded-[32px] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/40 hover:shadow-lg transition-shadow duration-300">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-lg">📅</span>
                </span>
                월별 수입/지출 추이
              </h3>
              <TrendChart data={monthlyTrendStats} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
