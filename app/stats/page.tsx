'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, PieChart as PieChartIcon, BarChart as BarChartIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { CategoryIcon } from '@/app/components/IconPicker';
import type { Transaction, Category } from '@/types/database';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98FB98', '#DDA0DD', '#FFD700', '#87CEEB'];

export default function StatsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentDate, setCurrentDate] = useState(new Date());

  // 카테고리 데이터 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      return data as Category[];
    },
    staleTime: Infinity,
  });

  // 이번 달 거래 내역 조회
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
        .eq('type', 'expense'); // 지출만 분석

      if (error) throw error;
      return data as Transaction[];
    },
  });

  // 최근 6개월 거래 내역 조회 (추이 분석용)
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

  // 카테고리별 지출 통계 (도넛 차트용)
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    currentMonthTransactions.forEach((t) => {
      // 카테고리 ID가 없으면 '미분류' 처리
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
          color: '', // 나중에 할당
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .map((item, index) => ({
        ...item,
        color: COLORS[index % COLORS.length],
      }));
  }, [currentMonthTransactions, categories]);

  // 월별 수입/지출 추이 (바 차트용)
  const monthlyTrend = useMemo(() => {
    const trend: Record<string, { income: number; expense: number }> = {};
    
    // 초기화 (최근 6개월)
    for (let i = 5; i >= 0; i--) {
      const monthStr = format(subMonths(currentDate, i), 'yyyy-MM');
      trend[monthStr] = { income: 0, expense: 0 };
    }

    trendTransactions.forEach((t) => {
      const monthStr = t.date.substring(0, 7); // YYYY-MM
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
    <div className="min-h-dvh bg-background p-4 pb-20">
      <div className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">지출 분석</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. 이달의 지출 (도넛 차트) */}
          <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/50">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <PieChartIcon className="h-5 w-5 text-primary" />
              {format(currentDate, 'M월')} 지출 분포
            </h2>
            
            <div className="h-[250px] w-full">
              {categoryStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="amount"
                    >
                      {categoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                       formatter={(value: any) => `${new Intl.NumberFormat('ko-KR').format(value || 0)}원`}
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                 <div className="flex h-full items-center justify-center text-muted-foreground">
                   지출 내역이 없습니다.
                 </div>
              )}
            </div>

            <div className="mt-4 text-center">
              <span className="text-sm text-muted-foreground">총 지출</span>
              <p className="text-2xl font-bold text-foreground">
                {new Intl.NumberFormat('ko-KR').format(totalExpense)}원
              </p>
            </div>

            {/* 카테고리 리스트 */}
            <div className="mt-6 space-y-3">
              {categoryStats.slice(0, 5).map((stat) => (
                <div key={stat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${stat.color}20`, color: stat.color }}
                    >
                      <CategoryIcon iconName={stat.icon} className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{stat.name}</span>
                  </div>
                  <div className="text-sm font-semibold">
                    {new Intl.NumberFormat('ko-KR').format(stat.amount)}원
                    <span className="ml-2 text-xs text-muted-foreground">
                      {Math.round((stat.amount / totalExpense) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. 최근 6개월 추이 (바 차트) */}
          <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/50">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <BarChartIcon className="h-5 w-5 text-primary" />
              수입/지출 추이
            </h2>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => `${new Intl.NumberFormat('ko-KR').format(value || 0)}원`}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="income" name="수입" fill="#4ECDC4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="지출" fill="#FF6B6B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
