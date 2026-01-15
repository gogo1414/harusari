'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserSettings } from '@/app/context/UserSettingsContext';
import { LogOut, List, Repeat, Loader2, Menu, BarChart3, Settings } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import Calendar from './components/Calendar';
import BottomSheet from './components/BottomSheet';
import FAB from './components/FAB';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createClient } from '@/lib/supabase/client';
import type { Transaction } from '@/types/database';

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  const { settings, categories } = useUserSettings();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // 타입별 BottomSheet 상태
  const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'income' | 'expense' | null>(null);

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

  // 타입별 목록 보기
  const handleTypeClick = (type: 'income' | 'expense') => {
    setSelectedType(type);
    setIsTypeSheetOpen(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // 거래 삭제 기능 (BottomSheet에서 호출)
  const handleDeleteTransaction = async (id: string) => {
    if(!confirm('삭제하시겠습니까?')) return;
    
    const { error } = await supabase.from('transactions').delete().eq('transaction_id', id);
    if (!error) {
       window.location.reload(); 
    }
  };

  // Calendar에 settings.week_start_day 전달 (0 or 1 -> 'sunday' or 'monday')
  const weekStartDay = settings.week_start_day === 1 ? 'monday' : 'sunday';

  return (
    <main className="flex min-h-dvh flex-col bg-background font-sans">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-background/80 px-6 py-4 backdrop-blur-xl border-b border-black/5 dark:border-white/5 transition-all">
        <div className="flex items-center gap-1">
           <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-3 h-11 w-11 rounded-full text-foreground/80 hover:bg-muted" aria-label="메뉴 열기">
                   <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0 rounded-r-[32px] border-r-0 shadow-2xl">
                 <SheetHeader className="p-8 text-left border-b border-border/50 bg-[#F9FAFB] dark:bg-muted/30">
                   <SheetTitle className="text-2xl font-extrabold text-primary flex items-center gap-2">
                     <span className="text-3xl">💸</span> 하루살이
                   </SheetTitle>
                   <p className="text-sm text-muted-foreground mt-1 font-medium">오늘 벌어 오늘 사는 1인 가계부</p>
                 </SheetHeader>
                 
                 <div className="flex flex-col p-4 gap-2 mt-2">
                    <Link href="/categories" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 rounded-2xl p-4 hover:bg-muted/80 transition-all group active:scale-95">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 group-hover:ring-primary/20 group-hover:text-primary transition-all">
                         <List className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <span className="font-bold text-lg text-foreground/90">카테고리 관리</span>
                    </Link>

                    <Link href="/recurring" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 rounded-2xl p-4 hover:bg-muted/80 transition-all group active:scale-95">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 group-hover:ring-primary/20 group-hover:text-primary transition-all">
                         <Repeat className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <span className="font-bold text-lg text-foreground/90">고정 지출/수입</span>
                    </Link>
                    
                    <Link href="/stats" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 rounded-2xl p-4 hover:bg-muted/80 transition-all group active:scale-95">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 group-hover:ring-primary/20 group-hover:text-primary transition-all">
                         <BarChart3 className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <span className="font-bold text-lg text-foreground/90">지출 분석</span>
                    </Link>

                    <Link href="/settings" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 rounded-2xl p-4 hover:bg-muted/80 transition-all group active:scale-95">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 group-hover:ring-primary/20 group-hover:text-primary transition-all">
                         <Settings className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <span className="font-bold text-lg text-foreground/90">환경 설정</span>
                    </Link>
                 </div>
                 
                 <div className="absolute bottom-8 left-0 right-0 px-6">
                    <Button 
                      variant="ghost" 
                      onClick={handleLogout}
                      className="w-full justify-start gap-3 h-14 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 px-4"
                    >
                      <LogOut className="h-5 w-5" />
                      <span className="font-semibold text-base">로그아웃</span>
                    </Button>
                 </div>
              </SheetContent>
           </Sheet>
           
           <h1 className="text-xl font-extrabold tracking-tight text-foreground ml-1">
            하루살이
           </h1>
        </div>
        
        {/* 우측 빈 공간 (레이아웃 균형을 위해) or Add notifications/profile later */}
        <div className="w-10" />
      </header>

      {/* 달력 섹션 */}
      <div className="flex-1 px-4 pt-4 pb-24">
        {/* Main Card */}
        <div className="rounded-[32px] bg-card p-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10 relative">
          {isLoading ? (
             <div className="flex h-[360px] items-center justify-center">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
            <Calendar
              transactions={transactions || []}
              onDateSelect={handleDateSelect}
              selectedDate={selectedDate || undefined}
              currentDate={currentMonth}
              onMonthChange={setCurrentMonth}
              weekStartDay={weekStartDay}
              cycleStartDay={settings.salary_cycle_date || 1}
            />
          )}
        </div>
        
        {/* 월 요약 카드 - Premium Tiles */}
        <div className="mt-6">
          <h2 className="px-2 text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            이번 달 현황
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
               {format(currentMonth, 'M월')}
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleTypeClick('income')}
              className="rounded-[24px] bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[110px] relative overflow-hidden group hover:shadow-md hover:ring-income/30 transition-all text-left active:scale-[0.98]"
            >
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <span className="text-4xl text-income">↘</span>
               </div>
               <p className="text-sm font-medium text-muted-foreground">수입</p>
               <p className="text-2xl font-extrabold text-income tracking-tight">
                 +{new Intl.NumberFormat('ko-KR').format(monthlyStats.income)}
               </p>
            </button>

            <button
              onClick={() => handleTypeClick('expense')}
              className="rounded-[24px] bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[110px] relative overflow-hidden group hover:shadow-md hover:ring-expense/30 transition-all text-left active:scale-[0.98]"
            >
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="text-4xl text-expense">↗</span>
               </div>
               <p className="text-sm font-medium text-muted-foreground">지출</p>
               <p className="text-2xl font-extrabold text-expense tracking-tight">
                 -{new Intl.NumberFormat('ko-KR').format(monthlyStats.expense)}
               </p>
            </button>
          </div>
        </div>
      </div>

      {/* 날짜별 BottomSheet */}
      <BottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        selectedDate={selectedDate}
        transactions={transactions || []}
        categories={categories}
        onEdit={() => {}} // TODO: 수정 기능 구현
        onDelete={handleDeleteTransaction}
        viewMode="date"
      />

      {/* 타입별 BottomSheet */}
      <BottomSheet
        isOpen={isTypeSheetOpen}
        onClose={() => setIsTypeSheetOpen(false)}
        selectedDate={null}
        transactions={transactions || []}
        categories={categories}
        onEdit={() => {}}
        onDelete={handleDeleteTransaction}
        viewMode="type"
        filterType={selectedType || undefined}
      />

      <FAB />
    </main>
  );
}
