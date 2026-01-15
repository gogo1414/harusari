'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useUserSettings } from '@/app/context/UserSettingsContext';
import { LogOut, List, Repeat, BarChart3, Settings } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Calendar from './components/Calendar';
import BottomSheet from './components/BottomSheet';
import FAB from './components/FAB';
import { AnimatedMenuIcon } from './components/AnimatedMenuIcon';
import { AnimatedCurrency } from './components/AnimatedNumber';
import { CalendarSkeleton, SummaryCardSkeleton } from './components/Skeleton';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/lib/toast';
import type { Transaction } from '@/types/database';

// 메뉴 아이템 애니메이션 variants
const menuItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.08, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const }
  })
};

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { settings, categories } = useUserSettings();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // 타입별 BottomSheet 상태
  const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'income' | 'expense' | null>(null);
  // 삭제 다이얼로그 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

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

  // 거래 삭제 다이얼로그 열기
  const handleDeleteRequest = (id: string) => {
    setTransactionToDelete(id);
    setDeleteDialogOpen(true);
  };

  // 거래 삭제 실행
  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return;

    const { error } = await supabase.from('transactions').delete().eq('transaction_id', transactionToDelete);
    if (!error) {
      showToast.transactionDeleted();
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } else {
      showToast.error('삭제에 실패했습니다');
    }
    setDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  // Calendar에 settings.week_start_day 전달 (0 or 1 -> 'sunday' or 'monday')
  const weekStartDay = settings.week_start_day === 1 ? 'monday' : 'sunday';

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에서는 무시
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + N: 새 거래 추가
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        router.push('/transactions/new');
      }

      // Escape: 모달/시트 닫기
      if (e.key === 'Escape') {
        if (deleteDialogOpen) {
          setDeleteDialogOpen(false);
        } else if (isBottomSheetOpen) {
          setIsBottomSheetOpen(false);
        } else if (isTypeSheetOpen) {
          setIsTypeSheetOpen(false);
        } else if (isMenuOpen) {
          setIsMenuOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, deleteDialogOpen, isBottomSheetOpen, isTypeSheetOpen, isMenuOpen]);

  return (
    <main className="flex min-h-dvh flex-col bg-background font-sans">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-background/80 px-6 py-4 backdrop-blur-xl border-b border-black/5 dark:border-white/5 transition-all">
        <div className="flex items-center gap-1">
           <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-3 h-11 w-11 rounded-full text-foreground/80 hover:bg-muted" aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}>
                   <AnimatedMenuIcon isOpen={isMenuOpen} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0 rounded-r-[32px] border-r-0 shadow-2xl">
                 <SheetHeader className="p-8 text-left border-b border-border/50 bg-[#F9FAFB] dark:bg-muted/30">
                   <SheetTitle className="text-2xl font-extrabold text-primary flex items-center gap-2">
                     <span className="text-3xl">💸</span> 하루살이
                   </SheetTitle>
                   <p className="text-sm text-muted-foreground mt-1 font-medium">오늘 벌어 오늘 사는 1인 가계부</p>
                 </SheetHeader>

                 <nav className="flex flex-col p-4 gap-2 mt-2" aria-label="주요 메뉴">
                    <AnimatePresence>
                      {isMenuOpen && (
                        <>
                          <motion.div custom={0} variants={menuItemVariants} initial="hidden" animate="visible">
                            <Link href="/categories" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 rounded-2xl p-4 transition-all group active:scale-95 ${pathname === '/categories' ? 'bg-primary/10' : 'hover:bg-muted/80'}`}>
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all ${pathname === '/categories' ? 'bg-primary/10 ring-primary/30' : 'bg-white ring-black/5 group-hover:ring-primary/20'}`}>
                                 <List className={`h-6 w-6 ${pathname === '/categories' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} aria-hidden="true" />
                              </div>
                              <span className={`font-bold text-lg ${pathname === '/categories' ? 'text-primary' : 'text-foreground/90'}`}>카테고리 관리</span>
                            </Link>
                          </motion.div>

                          <motion.div custom={1} variants={menuItemVariants} initial="hidden" animate="visible">
                            <Link href="/recurring" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 rounded-2xl p-4 transition-all group active:scale-95 ${pathname === '/recurring' ? 'bg-primary/10' : 'hover:bg-muted/80'}`}>
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all ${pathname === '/recurring' ? 'bg-primary/10 ring-primary/30' : 'bg-white ring-black/5 group-hover:ring-primary/20'}`}>
                                 <Repeat className={`h-6 w-6 ${pathname === '/recurring' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} aria-hidden="true" />
                              </div>
                              <span className={`font-bold text-lg ${pathname === '/recurring' ? 'text-primary' : 'text-foreground/90'}`}>고정 지출/수입</span>
                            </Link>
                          </motion.div>

                          <motion.div custom={2} variants={menuItemVariants} initial="hidden" animate="visible">
                            <Link href="/stats" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 rounded-2xl p-4 transition-all group active:scale-95 ${pathname === '/stats' ? 'bg-primary/10' : 'hover:bg-muted/80'}`}>
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all ${pathname === '/stats' ? 'bg-primary/10 ring-primary/30' : 'bg-white ring-black/5 group-hover:ring-primary/20'}`}>
                                 <BarChart3 className={`h-6 w-6 ${pathname === '/stats' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} aria-hidden="true" />
                              </div>
                              <span className={`font-bold text-lg ${pathname === '/stats' ? 'text-primary' : 'text-foreground/90'}`}>지출 분석</span>
                            </Link>
                          </motion.div>

                          <motion.div custom={3} variants={menuItemVariants} initial="hidden" animate="visible">
                            <Link href="/settings" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 rounded-2xl p-4 transition-all group active:scale-95 ${pathname === '/settings' ? 'bg-primary/10' : 'hover:bg-muted/80'}`}>
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all ${pathname === '/settings' ? 'bg-primary/10 ring-primary/30' : 'bg-white ring-black/5 group-hover:ring-primary/20'}`}>
                                 <Settings className={`h-6 w-6 ${pathname === '/settings' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} aria-hidden="true" />
                              </div>
                              <span className={`font-bold text-lg ${pathname === '/settings' ? 'text-primary' : 'text-foreground/90'}`}>환경 설정</span>
                            </Link>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                 </nav>

                 <div className="absolute bottom-8 left-0 right-0 px-6">
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      className="w-full justify-start gap-3 h-14 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 px-4"
                    >
                      <LogOut className="h-5 w-5" aria-hidden="true" />
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
             <CalendarSkeleton />
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
          {isLoading ? (
            <SummaryCardSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleTypeClick('income')}
                className="rounded-[24px] bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[110px] relative overflow-hidden group hover:shadow-md hover:ring-income/30 transition-all text-left active:scale-[0.98]"
                aria-label={`수입 ${monthlyStats.income.toLocaleString()}원 보기`}
              >
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" aria-hidden="true">
                   <span className="text-4xl text-income">↘</span>
                 </div>
                 <p className="text-sm font-medium text-muted-foreground">수입</p>
                 <p className="text-2xl font-extrabold tracking-tight">
                   <span className="text-income">+</span>
                   <AnimatedCurrency value={monthlyStats.income} type="income" />
                 </p>
              </button>

              <button
                onClick={() => handleTypeClick('expense')}
                className="rounded-[24px] bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[110px] relative overflow-hidden group hover:shadow-md hover:ring-expense/30 transition-all text-left active:scale-[0.98]"
                aria-label={`지출 ${monthlyStats.expense.toLocaleString()}원 보기`}
              >
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" aria-hidden="true">
                    <span className="text-4xl text-expense">↗</span>
                 </div>
                 <p className="text-sm font-medium text-muted-foreground">지출</p>
                 <p className="text-2xl font-extrabold tracking-tight">
                   <span className="text-expense">-</span>
                   <AnimatedCurrency value={monthlyStats.expense} type="expense" />
                 </p>
              </button>
            </div>
          )}
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
        onDelete={handleDeleteRequest}
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
        onDelete={handleDeleteRequest}
        viewMode="type"
        filterType={selectedType || undefined}
      />

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle>거래 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 거래를 삭제하시겠습니까? 삭제된 거래는 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FAB />
    </main>
  );
}
