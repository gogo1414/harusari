'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Transaction, Category } from '@/types/database';
import { useUserSettings } from '@/app/context/UserSettingsContext';
import StatSection from '@/app/components/StatSection';
import TrendChart from '@/app/components/TrendChart';

// Remove unused formatBarLabel since it's now part of TrendChart

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
  
  // 날짜 계산 (지난달 ~ 이번달)
  const startDate = startOfMonth(subMonths(currentDate, 1)); // 지난달 1일
  const endDate = endOfMonth(currentDate); // 이번달 말일

  const handleMonthChange = (delta: number) => {
    setCurrentDate((prev) => addMonths(prev, delta));
  };

  // 카테고리 데이터 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      return data as Category[];
    },
  });

  // 통합 트랜잭션 데이터 조회 (지난달 ~ 이번달)
  const { data: transactions = [], isLoading: isTransLoading } = useQuery({
    queryKey: ['transactions', 'stats', format(startDate, 'yyyy-MM'), format(endDate, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) throw new Error('Not authenticated');

      const { data: trans, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', data.user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;
      return trans as Transaction[];
    },
  });

  // 월별 추이 데이터 조회 (올해 전체)
  const startOfYearDate = new Date(currentDate.getFullYear(), 0, 1);
  const endOfYearDate = new Date(currentDate.getFullYear(), 11, 31);
  
  const { data: trendData = [], isLoading: isTrendLoading } = useQuery({
    queryKey: ['transactions', 'trend', currentDate.getFullYear()],
    queryFn: async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) throw new Error('Not authenticated');

      const { data: trans, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', data.user.id)
        .gte('date', format(subMonths(startOfYearDate, 6), 'yyyy-MM-dd'))
        .lte('date', format(endOfYearDate, 'yyyy-MM-dd'));

      if (error) throw error;
      return trans as Transaction[];
    },
  });

  const isLoading = isTransLoading || isTrendLoading;

  // 통계 계산 로직 분리
  const calculateStats = (transData: Transaction[]) => {
    const iStats: Record<string, number> = {};
    const eStats: Record<string, number> = {};
    let tIncome = 0;
    let tExpense = 0;

    transData.forEach((t) => {
      const catId = t.category_id || 'unknown';
      if (t.type === 'income') {
        iStats[catId] = (iStats[catId] || 0) + t.amount;
        tIncome += t.amount;
      } else {
        eStats[catId] = (eStats[catId] || 0) + t.amount;
        tExpense += t.amount;
      }
    });

    return { iStats, eStats, tIncome, tExpense };
  };

  // 데이터 처리 - 문자열 비교로 변경하여 타임존 이슈 해결
  const currentMonthStr = format(currentDate, 'yyyy-MM');
  const lastMonthStr = format(subMonths(currentDate, 1), 'yyyy-MM');

  const currentMonthTrans = transactions.filter(t => t.date.startsWith(currentMonthStr));
  const lastMonthTrans = transactions.filter(t => t.date.startsWith(lastMonthStr));

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

  const incomeStats = processStats(currentStats.iStats, INCOME_COLORS);
  const expenseStats = processStats(currentStats.eStats, EXPENSE_COLORS);

  const expenseDiff = currentStats.tExpense - lastStats.tExpense;
  const incomeDiff = currentStats.tIncome - lastStats.tIncome;

  // 수입/지출 추이 데이터 처리 (최근 6개월)
  const monthlyTrendStats = Array.from({ length: 6 }, (_, i) => {
    // 5개월 전부터 이번 달까지
    const targetDate = subMonths(currentDate, 5 - i);
    const monthStr = format(targetDate, 'yyyy-MM');
    // 해당 월의 데이터 필터링
    const monthTrans = trendData.filter(t => t.date.startsWith(monthStr));
    const income = monthTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    return {
      name: format(targetDate, 'M월'),
      income,
      expense,
      incomeLabel: income > 0 ? (income / 10000).toFixed(1) : '',
      expenseLabel: expense > 0 ? (expense / 10000).toFixed(1) : '',
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatBarLabel = (value: any) => {
    const num = Number(value);
    if (isNaN(num) || num === 0) return '';
    if (num >= 10000) return `${(num / 10000).toFixed(1)}만`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}천`;
    return new Intl.NumberFormat('ko-KR').format(num);
  };

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
        <div className="flex justify-center mb-2">
            <div className="flex items-center gap-4 bg-secondary/30 rounded-full px-5 py-2 hover:bg-secondary/40 transition-colors">
              <Button variant="ghost" size="icon" onClick={() => handleMonthChange(-1)} className="h-8 w-8 rounded-full hover:bg-background/50 text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-bold tabular-nums tracking-wide">
                {format(currentDate, 'yyyy년 M월', { locale: ko })}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => handleMonthChange(1)} className="h-8 w-8 rounded-full hover:bg-background/50 text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
        </div>

        {/* 메인 인사이트 섹션 (총 지출) */}
        <div className="flex flex-col items-center text-center gap-2 py-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <span className="text-sm font-semibold text-muted-foreground tracking-tight">이번 달 총 지출</span>
           <h1 className="text-5xl font-extrabold tracking-tighter tabular-nums text-foreground drop-shadow-sm">
             {new Intl.NumberFormat('ko-KR').format(currentStats.tExpense)}
             <span className="text-2xl font-bold ml-1 text-muted-foreground font-sans tracking-normal">원</span>
           </h1>
           
           {/* 전월 대비 증감 배지 */}
           <div className={`mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-bold shadow-sm ring-1 ring-inset transition-all ${
             expenseDiff > 0 
               ? 'bg-red-500/10 text-red-600 ring-red-500/20' 
               : expenseDiff < 0 
                 ? 'bg-blue-500/10 text-blue-600 ring-blue-500/20' 
                 : 'bg-secondary text-secondary-foreground ring-black/5'
           }`}>
             {expenseDiff > 0 ? '📈' : expenseDiff < 0 ? '📉' : '➖'}
             {expenseDiff === 0 
               ? '지난달과 지출이 같아요' 
               : <span>지난달보다 <span className="tabular-nums">{new Intl.NumberFormat('ko-KR').format(Math.abs(expenseDiff))}원</span> {expenseDiff > 0 ? '더 썼어요' : '덜 썼어요'}</span>}
           </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100 fill-mode-backwards">
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
                total={currentStats.tExpense} 
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
                total={currentStats.tIncome} 
                type="income" 
                diffAmount={incomeDiff} 
              />
            </div>
            
            {/* 월별 추이 (BarChart) */}
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
