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
    <main className="flex min-h-dvh flex-col bg-background">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
           <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 h-10 w-10 text-foreground/80 hover:bg-muted" aria-label="메뉴 열기">
                   <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
                 <SheetHeader className="p-6 text-left border-b border-border/50 bg-muted/30">
                   <SheetTitle className="text-xl font-bold text-primary">하루살이</SheetTitle>
                   <p className="text-sm text-muted-foreground">오늘 벌어 오늘 사는 1인 가계부</p>
                 </SheetHeader>
                 
                 <div className="flex flex-col p-4 gap-2">
                    <Link href="/categories" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted transition-colors group">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 text-primary transition-colors">
                         <List className="h-5 w-5" />
                      </div>
                      <span className="font-medium text-lg">카테고리 관리</span>
                    </Link>

                    <Link href="/recurring" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted transition-colors group">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 text-primary transition-colors">
                         <Repeat className="h-5 w-5" />
                      </div>
                      <span className="font-medium text-lg">고정 지출/수입</span>
                    </Link>
                    
                    <Link href="/stats" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted transition-colors group">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 text-primary transition-colors">
                         <BarChart3 className="h-5 w-5" />
                      </div>
                      <span className="font-medium text-lg">지출 분석</span>
                    </Link>

                    <Link href="/settings" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted transition-colors group">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 text-primary transition-colors">
                         <Settings className="h-5 w-5" />
                      </div>
                      <span className="font-medium text-lg">환경 설정</span>
                    </Link>
                 </div>
                 
                 <div className="absolute bottom-8 left-0 right-0 px-4">
                    <Button 
                      variant="ghost" 
                      onClick={handleLogout}
                      className="w-full justify-start gap-2 h-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/5"
                    >
                      <LogOut className="h-5 w-5" />
                      <span className="font-medium">로그아웃</span>
                    </Button>
                 </div>
              </SheetContent>
           </Sheet>
           
           <h1 className="text-xl font-bold tracking-tight text-primary">
            하루살이
           </h1>
        </div>
        
        {/* 우측 빈 공간 (레이아웃 균형을 위해) */}
        <div className="w-8" />
      </header>

      {/* 달력 섹션 */}
      <div className="flex-1 px-2 pt-2 pb-24">
        <div className="rounded-3xl bg-card p-4 shadow-sm ring-1 ring-border/50">
          {isLoading ? (
             <div className="flex h-[300px] items-center justify-center">
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
        transactions={transactions || []}
        categories={categories}
        onEdit={() => {}} // TODO: 수정 기능 구현
        onDelete={handleDeleteTransaction}
      />

      <FAB />
    </main>
  );
}
