'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatSection from '@/app/components/StatSection';
import TrendChart from '@/app/components/TrendChart';

// Legacy Recharts imports removed

export default function MockStatsPage() {
  const router = useRouter();

  // Mock Data
  const currentTotalExpense = 2450000;
  const currentTotalIncome = 3200000;
  const expenseDiff = 320000; // 지난달보다 더 씀

  const expenseStats = [
    { name: '식비', amount: 1250000, icon: '🍔', color: '#F04452' }, // Red
    { name: '교통/차량', amount: 450000, icon: '🚗', color: '#FFB800' }, // Yellow
    { name: '주거/통신', amount: 350000, icon: '🏠', color: '#EC4899' }, // Pink
    { name: '쇼핑/뷰티', amount: 200000, icon: '🛍️', color: '#F97316' }, // Orange
    { name: '생활/마트', amount: 150000, icon: '🛒', color: '#6366F1' }, // Indigo
    { name: '경조사/회비', amount: 50000, icon: '🎉', color: '#10B981' }, // Emerald
  ];

  const incomeStats = [
    { name: '월급', amount: 3000000, icon: '💰', color: '#3182F6' }, // Blue
    { name: '용돈', amount: 150000, icon: '💸', color: '#33C7A2' }, // Mint
    { name: '중고거래', amount: 50000, icon: '📦', color: '#06B6D4' }, // Cyan
  ];

  const monthlyTrendStats = [
    { name: '1월', income: 3000000, expense: 2100000, incomeLabel: '300.0천', expenseLabel: '210.0천' },
    { name: '2월', income: 3000000, expense: 2300000, incomeLabel: '300.0천', expenseLabel: '230.0천' },
    { name: '3월', income: 3200000, expense: 2500000, incomeLabel: '320.0천', expenseLabel: '250.0천' },
    { name: '4월', income: 3200000, expense: 2200000, incomeLabel: '320.0천', expenseLabel: '220.0천' },
    { name: '5월', income: 3100000, expense: 2800000, incomeLabel: '310.0천', expenseLabel: '280.0천' },
    { name: '6월', income: 3300000, expense: 2450000, incomeLabel: '330.0천', expenseLabel: '245.0천' },
  ];

  const formatBarLabel = (value: any) => {
    const num = Number(value);
    if (isNaN(num) || num === 0) return '';
    return new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(num);
  };

  return (
    <div className="flex flex-col min-h-dvh bg-background pb-24 font-sans max-w-md mx-auto border-x border-border/50 shadow-2xl">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-sm px-4 py-3 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 rounded-full h-10 w-10 hover:bg-black/5 dark:hover:bg-white/10">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="flex items-center gap-2">
           <span className="text-xs font-bold px-2 py-1 bg-yellow-500/10 text-yellow-600 rounded">TEST MODE</span>
           <span className="text-lg font-bold">지출 분석 (Mock)</span>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 p-5 space-y-8">
        {/* 날짜 네비게이션 */}
        <div className="flex justify-center mb-2">
            <div className="flex items-center gap-4 bg-secondary/30 rounded-full px-5 py-2 hover:bg-secondary/40 transition-colors cursor-pointer">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-bold tabular-nums tracking-wide">
                2026년 6월
              </h2>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
        </div>

        {/* 메인 인사이트 섹션 (총 지출) */}
        <div className="flex flex-col items-center text-center gap-2 py-4">
           <span className="text-sm font-semibold text-muted-foreground tracking-tight">이번 달 총 지출</span>
           <h1 className="text-5xl font-extrabold tracking-tighter tabular-nums text-foreground drop-shadow-sm">
             {new Intl.NumberFormat('ko-KR').format(currentTotalExpense)}
             <span className="text-2xl font-bold ml-1 text-muted-foreground font-sans tracking-normal">원</span>
           </h1>
           
           <div className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-bold shadow-sm ring-1 ring-inset bg-red-500/10 text-red-600 ring-red-500/20">
             📈 지난달보다 <span className="tabular-nums">320,000원</span> 더 썼어요
           </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
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
                total={currentTotalExpense} 
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
                total={currentTotalIncome} 
                type="income" 
              />
            </div>
            
            {/* 월별 추이 (BarChart) */}
            <div className="bg-card rounded-[32px] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/40 hover:shadow-lg transition-shadow duration-300">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-lg">📅</span>
                </span>
                월별 수입/지출 추이
              </h3>
              <TrendChart data={monthlyTrendStats} />
            </div>
        </div>
      </div>
    </div>
  );
}
