'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, PieChart as PieChartIcon, BarChart as BarChartIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, setDate, subDays, addMonths } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LabelList } from 'recharts';
import { CategoryIcon } from '@/app/components/IconPicker';
import type { Transaction, Category } from '@/types/database';
import { useUserSettings } from '@/app/context/UserSettingsContext';

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

interface StatData {
  name: string;
  amount: number;
  icon: string;
  color: string;
  [key: string]: any;
}

function StatSection({ title, stats, total, type }: { title: string; stats: StatData[]; total: number; type: 'income' | 'expense' }) {
  const isIncome = type === 'income';
  
  // 데이터가 없으면 렌더링하지 않음 (수입의 경우)
  if (total === 0 && type === 'income') return null;

  return (
    <section className="rounded-[28px] bg-card p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <div className="flex items-center justify-between mb-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isIncome ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}>
            <PieChartIcon className="h-4 w-4" />
          </span>
          {title}
        </h2>
      </div>

      <div className="h-[280px] w-full relative">
        {stats.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={90}
                paddingAngle={4}
                dataKey="amount"
                cornerRadius={6}
                stroke="none"
              >
                {stats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number | string | undefined) => `${new Intl.NumberFormat('ko-KR').format(Number(value) || 0)}원`}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.95)' }}
                itemStyle={{ fontWeight: 'bold', color: '#191F28' }}
                labelStyle={{ display: 'none' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-2">
            <span className="text-4xl opacity-20">📊</span>
            <p>{isIncome ? '수입' : '지출'} 내역이 없습니다.</p>
          </div>
        )}
        
        {/* Center Text */}
        {stats.length > 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <span className="text-xs font-semibold text-muted-foreground block mb-1">총 {isIncome ? '수입' : '지출'}</span>
            <p className="text-xl font-extrabold text-foreground">
              {new Intl.NumberFormat('ko-KR').format(total)}
            </p>
          </div>
        )}
      </div>

      {/* 카테고리 리스트 */}
      {stats.length > 0 && (
        <div className="mt-8 space-y-4">
          {stats.slice(0, 5).map((stat) => (
            <div key={stat.name} className="flex items-center justify-between group">
              <div className="flex items-center gap-3.5">
                <div 
                  className="flex h-10 w-10 items-center justify-center rounded-[14px] shadow-sm transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
                >
                  <CategoryIcon iconName={stat.icon} className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[15px] font-bold text-foreground">{stat.name}</span>
                    <span className="text-xs text-muted-foreground font-medium">
                       {Math.round((stat.amount / total) * 100)}%
                    </span>
                </div>
              </div>
              <div className="text-[15px] font-bold tracking-tight">
                {new Intl.NumberFormat('ko-KR').format(stat.amount)}원
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentDate] = useState(new Date());

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      return data as Category[];
    },
    staleTime: Infinity,
  });

  const { settings } = useUserSettings();
  const salaryCycleDate = settings?.salary_cycle_date || 1;

  // 1. 이번 달 내역 (전체 조회 - 수입/지출 분리 계산)
  const { data: currentMonthTransactions = [], isLoading: isCurrentLoading } = useQuery({
    queryKey: ['transactions', format(currentDate, 'yyyy-MM'), salaryCycleDate, 'all'],
    queryFn: async () => {
      let startDate, endDate;
      if (salaryCycleDate === 1) {
        startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
        endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      } else {
         const prevMonth = subMonths(currentDate, 1);
         const start = setDate(prevMonth, salaryCycleDate);
         const end = subDays(addMonths(start, 1), 1);
         startDate = format(start, 'yyyy-MM-dd');
         endDate = format(end, 'yyyy-MM-dd');
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);
        
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!settings,
  });

  const { data: trendTransactions = [], isLoading: isTrendLoading } = useQuery({
    queryKey: ['transactions', 'trend', salaryCycleDate],
    queryFn: async () => {
      // 사이클 변동을 고려하여 앞뒤로 넉넉하게 조회 (6개월 전 ~ 다음 달)
      const endDate = format(endOfMonth(addMonths(currentDate, 1)), 'yyyy-MM-dd');
      const startDate = format(startOfMonth(subMonths(currentDate, 6)), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;
      return data as Transaction[];
    },
  });

  const { incomeStats, expenseStats, totalIncome, totalExpense } = useMemo(() => {
    const iStats: Record<string, number> = {};
    const eStats: Record<string, number> = {};
    let tIncome = 0;
    let tExpense = 0;

    currentMonthTransactions.forEach((t) => {
      const catId = t.category_id || 'unknown';
      if (t.type === 'income') {
        iStats[catId] = (iStats[catId] || 0) + t.amount;
        tIncome += t.amount;
      } else {
        eStats[catId] = (eStats[catId] || 0) + t.amount;
        tExpense += t.amount;
      }
    });

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

    return {
      incomeStats: processStats(iStats, INCOME_COLORS),
      expenseStats: processStats(eStats, EXPENSE_COLORS),
      totalIncome: tIncome,
      totalExpense: tExpense
    };
  }, [currentMonthTransactions, categories]);

  const monthlyTrend = useMemo(() => {
    const trend: Record<string, { income: number; expense: number }> = {};
    // 최근 6개월 키 생성
    for (let i = 5; i >= 0; i--) {
      const monthStr = format(subMonths(currentDate, i), 'yyyy-MM');
      trend[monthStr] = { income: 0, expense: 0 };
    }

    trendTransactions.forEach((t) => {
      const tDate = parseISO(t.date);
      let targetMonthStr = '';
      
      // 급여 사이클 적용하여 귀속 월 계산
      if (salaryCycleDate === 1) {
        targetMonthStr = format(tDate, 'yyyy-MM');
      } else {
        if (tDate.getDate() >= salaryCycleDate) {
           targetMonthStr = format(addMonths(tDate, 1), 'yyyy-MM');
        } else {
           targetMonthStr = format(tDate, 'yyyy-MM');
        }
      }

      if (trend[targetMonthStr]) {
        if (t.type === 'income') trend[targetMonthStr].income += t.amount;
        else trend[targetMonthStr].expense += t.amount;
      }
    });

    return Object.entries(trend).map(([month, data]) => ({
      name: format(parseISO(month + '-01'), 'M월'),
      income: data.income,
      expense: data.expense,
    }));
  }, [trendTransactions, currentDate, salaryCycleDate]);

  const isLoading = isCurrentLoading || isTrendLoading;

  const formatBarLabel = (value: any) => {
    const num = Number(value);
    if (isNaN(num) || num === 0) return '';
    if (num >= 10000) return `${(num / 10000).toFixed(1)}만`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}천`;
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  return (
    <div className="min-h-dvh bg-background p-4 pb-20 font-sans">
      <div className="mb-6 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10 py-2 -mx-4 px-4 border-b border-black/5 dark:border-white/5">
         <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 rounded-full h-10 w-10">
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-xl font-extrabold tracking-tight">지출 분석</h1>
         </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. 지출 분포 (메인) */}
          <StatSection 
            title={`${format(currentDate, 'M월')} 지출 분포`}
            stats={expenseStats} 
            total={totalExpense} 
            type="expense" 
          />

          {/* 2. 수입 분포 (서브: 수입이 있을 때만) */}
          <StatSection 
            title={`${format(currentDate, 'M월')} 수입 분포`}
            stats={incomeStats} 
            total={totalIncome} 
            type="income" 
          />

          {/* 3. 최근 6개월 추이 (바 차트) */}
          <section className="rounded-[28px] bg-card p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-foreground">
               <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                 <BarChartIcon className="h-4 w-4" />
               </span>
              수입/지출 추이
            </h2>
            <div className="h-[220px] w-full pl-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} barGap={4} margin={{ top: 20 }}>
                  <XAxis 
                      dataKey="name" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: '#8B95A1' }} 
                      dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: '#F2F4F6', radius: 8 }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number | string | undefined) => `${new Intl.NumberFormat('ko-KR').format(Number(value) || 0)}원`}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="income" name="수입" fill="#3182F6" radius={[6, 6, 6, 6]} barSize={12}>
                    <LabelList dataKey="income" position="top" formatter={formatBarLabel} fontSize={10} fill="#3182F6" dy={-4} />
                  </Bar>
                  <Bar dataKey="expense" name="지출" fill="#F04452" radius={[6, 6, 6, 6]} barSize={12}>
                    <LabelList dataKey="expense" position="top" formatter={formatBarLabel} fontSize={10} fill="#F04452" dy={-4} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
