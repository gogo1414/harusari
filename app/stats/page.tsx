'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, PieChart as PieChartIcon, BarChart as BarChartIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { CategoryIcon } from '@/app/components/IconPicker';
import type { Transaction, Category } from '@/types/database';

const COLORS = [
  '#3182F6', // Toss Blue
  '#F04452', // Red
  '#33C7A2', // Mint
  '#FFB800', // Yellow
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

export default function StatsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentDate] = useState(new Date());

  // ... (Queries remain same) ...
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      return data as Category[];
    },
    staleTime: Infinity,
  });

  const { data: currentMonthTransactions = [], isLoading: isCurrentLoading } = useQuery({
    queryKey: ['transactions', format(currentDate, 'yyyy-MM')],
    queryFn: async () => {
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('type', 'expense'); 

      if (error) throw error;
      return data as Transaction[];
    },
  });

  const { data: trendTransactions = [], isLoading: isTrendLoading } = useQuery({
    queryKey: ['transactions', 'trend'],
    queryFn: async () => {
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      const startDate = format(startOfMonth(subMonths(currentDate, 5)), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;
      return data as Transaction[];
    },
  });

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    currentMonthTransactions.forEach((t) => {
      const catId = t.category_id || 'unknown';
      stats[catId] = (stats[catId] || 0) + t.amount;
    });

    return Object.entries(stats)
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
        color: COLORS[index % COLORS.length],
      }));
  }, [currentMonthTransactions, categories]);

  const monthlyTrend = useMemo(() => {
    const trend: Record<string, { income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const monthStr = format(subMonths(currentDate, i), 'yyyy-MM');
      trend[monthStr] = { income: 0, expense: 0 };
    }
    trendTransactions.forEach((t) => {
      const monthStr = t.date.substring(0, 7); 
      if (trend[monthStr]) {
        if (t.type === 'income') trend[monthStr].income += t.amount;
        else trend[monthStr].expense += t.amount;
      }
    });

    return Object.entries(trend).map(([month, data]) => ({
      name: format(parseISO(month + '-01'), 'M월'),
      income: data.income,
      expense: data.expense,
    }));
  }, [trendTransactions, currentDate]);

  const totalExpense = categoryStats.reduce((sum, item) => sum + item.amount, 0);
  const isLoading = isCurrentLoading || isTrendLoading;

  return (
    <div className="min-h-dvh bg-background p-4 pb-20 font-sans">
      <div className="mb-6 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10 py-2 -mx-4 px-4 border-b border-black/5 dark:border-white/5">
         <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 rounded-full h-10 w-10">
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-xl font-extrabold tracking-tight">지출 분석</h1>
         </div>
         {/* Could add month picker here later */}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. 이달의 지출 (도넛 차트) */}
          <section className="rounded-[28px] bg-card p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-foreground">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                 <PieChartIcon className="h-4 w-4" />
              </span>
              {format(currentDate, 'M월')} 지출 분포
            </h2>
            
            <div className="h-[280px] w-full relative">
              {categoryStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="amount"
                      cornerRadius={6}
                      stroke="none"
                    >
                      {categoryStats.map((entry, index) => (
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
                   <p>지출 내역이 없습니다.</p>
                 </div>
              )}
              {/* Center Text */}
              {categoryStats.length > 0 && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                     <span className="text-xs font-semibold text-muted-foreground block mb-1">총 지출</span>
                     <p className="text-xl font-extrabold text-foreground">
                       {new Intl.NumberFormat('ko-KR').format(totalExpense)}
                     </p>
                  </div>
              )}
            </div>

            {/* 카테고리 리스트 */}
            <div className="mt-8 space-y-4">
              {categoryStats.slice(0, 5).map((stat) => (
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
                           {Math.round((stat.amount / totalExpense) * 100)}%
                        </span>
                    </div>
                  </div>
                  <div className="text-[15px] font-bold tracking-tight">
                    {new Intl.NumberFormat('ko-KR').format(stat.amount)}원
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. 최근 6개월 추이 (바 차트) */}
          <section className="rounded-[28px] bg-card p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-foreground">
               <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                 <BarChartIcon className="h-4 w-4" />
               </span>
              수입/지출 추이
            </h2>
            <div className="h-[220px] w-full pl-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} barGap={4}>
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
                  <Bar dataKey="income" name="수입" fill="#3182F6" radius={[6, 6, 6, 6]} barSize={12} />
                  <Bar dataKey="expense" name="지출" fill="#F04452" radius={[6, 6, 6, 6]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
