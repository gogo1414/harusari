'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Settings, LogOut, List, Repeat, ChevronRight, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import Calendar from './components/Calendar';
import BottomSheet from './components/BottomSheet';
import FAB from './components/FAB';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import type { Transaction, Category } from '@/types/database';

export default function HomePage() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // 카테고리 데이터 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      return data as Category[];
    },
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });

  // 거래 내역 데이터 조회 (현재 월 기준)
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true }); // 날짜순 정렬

      if (error) throw error;
      return data as Transaction[];
    },
  });

  // 월 통계 계산
  const monthlyStats = useMemo(() => {
    return transactions.reduce(
      (acc, t) => {
        if (t.type === 'income') acc.income += t.amount;
        else acc.expense += t.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setIsBottomSheetOpen(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // 거래 삭제 기능 (BottomSheet에서 호출)
  // TODO: React Query mutation 연동 필요 (TransactionForm 구현 시 함께 처리)
  const handleDeleteTransaction = async (id: string) => {
    if(!confirm('삭제하시겠습니까?')) return;
    
    // 임시 삭제 로직 (실제로는 mutation 사용)
    const { error } = await supabase.from('transactions').delete().eq('transaction_id', id);
    if (!error) {
       // 쿼리 무효화 필요 (나중에 구현)
       window.location.reload(); 
    }
  };

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-5 py-4 backdrop-blur-md">
        <h1 className="text-xl font-bold tracking-tight text-primary">
          하루살이
        </h1>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted">
              <Settings className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 font-medium">
            <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground">
              설정
            </DropdownMenuLabel>
            
            <DropdownMenuItem asChild className="rounded-lg p-2 focus:bg-muted cursor-pointer">
              <Link href="/categories" className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  <span>카테고리 관리</span>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="my-1 bg-border/50" />
            
            <DropdownMenuItem 
              onClick={handleLogout}
              className="rounded-lg p-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                <span>로그아웃</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* 달력 섹션 */}
      <div className="flex-1 px-2 pt-2 pb-24">
        <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/50">
          {isLoading ? (
             <div className="flex h-[300px] items-center justify-center">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
            <Calendar
              transactions={transactions}
              onDateSelect={handleDateSelect}
              selectedDate={selectedDate || undefined}
              currentDate={currentMonth}
              onMonthChange={setCurrentMonth}
            />
          )}
        </div>
        
        {/* 월 요약 카드 */}
        <div className="mt-6 grid grid-cols-2 gap-4 px-2">
          <div className="rounded-2xl bg-income/10 p-4 text-center">
            <p className="text-xs font-medium text-income/80">이번 달 수입</p>
            <p className="mt-1 text-lg font-bold text-income">
              {new Intl.NumberFormat('ko-KR').format(monthlyStats.income)}원
            </p>
          </div>
          <div className="rounded-2xl bg-expense/10 p-4 text-center">
            <p className="text-xs font-medium text-expense/80">이번 달 지출</p>
            <p className="mt-1 text-lg font-bold text-expense">
              {new Intl.NumberFormat('ko-KR').format(monthlyStats.expense)}원
            </p>
          </div>
        </div>
      </div>

      <BottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        selectedDate={selectedDate}
        transactions={transactions}
        categories={categories}
        onEdit={() => {}} // TODO: 수정 기능 구현
        onDelete={handleDeleteTransaction}
      />

      <FAB />
    </main>
  );
}
