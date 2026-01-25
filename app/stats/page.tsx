'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, addMonths, subMonths } from 'date-fns';
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
import { getCycleRange, filterByDateRange } from '@/lib/date';

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

export default function StatsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { settings } = useUserSettings();
  const { budgetGoals } = useBudgetGoals();
  const cycleStartDay = settings.salary_cycle_date || 1;

  const currentCycle = getCycleRange(currentDate, cycleStartDay);
  const lastCycle = getCycleRange(subMonths(currentCycle.start, 1), cycleStartDay);

  // 통합 트랜잭션 데이터 조회
  const fetchStart = format(subMonths(lastCycle.start, 1), 'yyyy-MM-dd');
  const fetchEnd = format(addMonths(currentCycle.end, 1), 'yyyy-MM-dd');

  const handleMonthChange = (delta: number) => {
    const newBaseDate = addMonths(currentCycle.start, delta);
    setCurrentDate(newBaseDate);
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

  const { data: transactions = [], isLoading: isTransLoading } = useQuery({
    queryKey: ['transactions', 'stats', fetchStart, fetchEnd],
    queryFn: async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) throw new Error('Not authenticated');

      const { data: trans, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', data.user.id)
        .gte('date', fetchStart)
        .lte('date', fetchEnd)
        .order('date', { ascending: false });

      if (error) throw error;
      return trans as Transaction[];
    },
  });

  // 월별 추이 데이터 조회
  const trendStart = format(subMonths(currentDate, 8), 'yyyy-MM-dd');
  const trendEnd = format(addMonths(currentDate, 2), 'yyyy-MM-dd');
  
  const { data: trendData = [], isLoading: isTrendLoading } = useQuery({
    queryKey: ['transactions', 'trend', currentDate.getFullYear(), cycleStartDay],
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

  const isLoading = isTransLoading || isTrendLoading;

  // 통계 계산 로직 분리 및 네이밍 개선 
  const calculateStats = (transData: Transaction[]) => {
    const incomeByCat: Record<string, number> = {};
    const expenseByCat: Record<string, number> = {};
    let totalIncome = 0;
    let totalExpense = 0;

    transData.forEach((t) => {
      const catId = t.category_id || 'unknown';
      if (t.type === 'income') {
        incomeByCat[catId] = (incomeByCat[catId] || 0) + t.amount;
        totalIncome += t.amount;
      } else {
        expenseByCat[catId] = (expenseByCat[catId] || 0) + t.amount;
        totalExpense += t.amount;
      }
    });

    return { incomeByCat, expenseByCat, totalIncome, totalExpense };
  };

  const currentMonthTrans = filterByDateRange(transactions, currentCycle.start, currentCycle.end);
  const lastMonthTrans = filterByDateRange(transactions, lastCycle.start, lastCycle.end);

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
        
        const percentage = (spent / goal.amount) * 100;
        
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

  const expenseDiff = currentStats.totalExpense - lastStats.totalExpense;
  const incomeDiff = currentStats.totalIncome - lastStats.totalIncome;

  // 수입/지출 추이 데이터 처리
  const monthlyTrendStats = Array.from({ length: 6 }, (_, i) => {
    const targetBaseDate = subMonths(currentCycle.start, 5 - i);
    const { start: cycleStart, end: cycleEnd } = getCycleRange(targetBaseDate, cycleStartDay);
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
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 rounded-full h-10 w-10 hover:bg-black/5 dark:hover:bg-white/10">
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
             <BudgetAnalysisCard data={budgetAnalysis} />

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
