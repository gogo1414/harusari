'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useUserSettings } from '@/app/context/UserSettingsContext';
import { LogOut, List, Repeat, BarChart3, Settings, Trash2, Edit2, Calculator } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CategoryIcon } from './components/IconPicker';
import type { Category, Transaction } from '@/types/database';
import Calendar from './components/Calendar';
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
import { getCycleRange, filterByDateRange } from '@/lib/date';
import { formatCurrency } from '@/lib/format';

function TransactionItem({
  transaction,
  categories,
  onDelete,
  onEdit,
}: {
  transaction: Transaction;
  categories: Category[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const category = categories.find((c) => c.category_id === transaction.category_id);
  const icon = category?.icon || 'money';
  const name = category?.name || '미분류';

  return (
    <div className="flex items-center gap-3 sm:gap-4 py-3 group">
       <CategoryIcon
         iconName={icon}
         className="h-10 w-10 sm:h-11 sm:w-11 shrink-0"
         variant="squircle"
         showBackground={true}
       />
       <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] sm:text-[16px] truncate leading-tight mb-0.5">
            {transaction.memo || name}
          </p>
          <div className="flex items-center text-[11px] sm:text-xs text-muted-foreground font-medium gap-1 truncate">
             <span className="shrink-0">{format(parseISO(transaction.date), 'M.d (EEE)', { locale: ko })}</span>
             <span>·</span>
             <span className="truncate">{name}</span>
          </div>
       </div>
       <div className="text-right shrink-0">
          <span className={`block font-bold text-[15px] sm:text-[16px] whitespace-nowrap ${
            transaction.type === 'income' ? 'text-income' : 'text-expense'
          }`}>
            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
          </span>
       </div>
       <div className="flex items-center gap-0.5 sm:gap-1 pl-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(transaction.transaction_id)}
          className="h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 active:opacity-70 transition-colors"
          aria-label="수정"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(transaction.transaction_id)}
          className="h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 active:opacity-70 transition-colors"
          aria-label="삭제"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
       </div>
    </div>
  );
}

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
  const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false);
  // 삭제 다이얼로그 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // 거래 내역 데이터 조회 (달력 표시를 위해 전후 1달 여유 있게 조회)
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      // 달력은 급여일 설정에 따라 이전/다음 달 날짜도 보여주므로 범위를 넉넉하게 잡음 (전후 2개월)
      const startDate = format(startOfMonth(subMonths(currentMonth, 2)), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(addMonths(currentMonth, 2)), 'yyyy-MM-dd');

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

  // 1. 사이클 범위 계산 및 데이터 필터링
  const { cycleTransactions } = useMemo(() => {
    if (!settings) return { cycleTransactions: [], cycleRange: { start: '', end: '' } };

    const cycleStartDay = settings.salary_cycle_date || 1;
    const { start, end } = getCycleRange(currentMonth, cycleStartDay);

    // 범위 내 데이터 필터링 및 날짜 내림차순 정렬
    const filtered = filterByDateRange(transactions, start, end)
      .sort((a, b) => b.date.localeCompare(a.date));

    return { cycleTransactions: filtered };
  }, [transactions, currentMonth, settings]);

  // 2. 월 통계 계산 (필터링된 데이터 사용)
  const monthlyStats = useMemo(() => {
    return cycleTransactions.reduce(
      (acc, t) => {
        if (t.type === 'income') acc.income += t.amount;
        else acc.expense += t.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [cycleTransactions]);

  // 3. 리스트 그룹핑 (날짜별)
  const groupedTransactions = useMemo(() => {
    const grouped: Record<string, Transaction[]> = {};
    cycleTransactions.forEach(t => {
      if (!grouped[t.date]) grouped[t.date] = [];
      grouped[t.date].push(t);
    });
    return grouped;
  }, [cycleTransactions]);

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setIsBottomSheetOpen(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/transactions/edit/${id}`);
  };

  // 타입별 목록 보기
  const handleTypeClick = () => {
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
                            <Link href="/installment/new" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 rounded-2xl p-4 transition-all group active:scale-95 ${pathname === '/installment/new' ? 'bg-primary/10' : 'hover:bg-muted/80'}`}>
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all ${pathname === '/installment/new' ? 'bg-primary/10 ring-primary/30' : 'bg-white ring-black/5 group-hover:ring-primary/20'}`}>
                                 <Calculator className={`h-6 w-6 ${pathname === '/installment/new' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} aria-hidden="true" />
                              </div>
                              <span className={`font-bold text-lg ${pathname === '/installment/new' ? 'text-primary' : 'text-foreground/90'}`}>할부 등록</span>
                            </Link>
                          </motion.div>

                          <motion.div custom={3} variants={menuItemVariants} initial="hidden" animate="visible">
                            <Link href="/stats" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 rounded-2xl p-4 transition-all group active:scale-95 ${pathname === '/stats' ? 'bg-primary/10' : 'hover:bg-muted/80'}`}>
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all ${pathname === '/stats' ? 'bg-primary/10 ring-primary/30' : 'bg-white ring-black/5 group-hover:ring-primary/20'}`}>
                                 <BarChart3 className={`h-6 w-6 ${pathname === '/stats' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} aria-hidden="true" />
                              </div>
                              <span className={`font-bold text-lg ${pathname === '/stats' ? 'text-primary' : 'text-foreground/90'}`}>지출 분석</span>
                            </Link>
                          </motion.div>

                          <motion.div custom={4} variants={menuItemVariants} initial="hidden" animate="visible">
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
              cycleStartDay={settings?.salary_cycle_date || 1}
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
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button
                onClick={handleTypeClick}
                className="rounded-[24px] bg-card p-4 sm:p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[100px] sm:h-[110px] relative overflow-hidden group hover:shadow-md hover:ring-income/30 transition-all text-left active:scale-[0.98]"
                aria-label={`수입 ${monthlyStats.income.toLocaleString()}원 보기`}
              >
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" aria-hidden="true">
                   <span className="text-3xl sm:text-4xl text-income">↘</span>
                 </div>
                 <p className="text-xs sm:text-sm font-medium text-muted-foreground">수입</p>
                 <p className="text-[clamp(18px,5vw,24px)] font-extrabold tracking-tight truncate w-full">
                   <span className="text-income">+</span>
                   <AnimatedCurrency value={monthlyStats.income} type="income" />
                 </p>
              </button>

              <button
                onClick={handleTypeClick}
                className="rounded-[24px] bg-card p-4 sm:p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between h-[100px] sm:h-[110px] relative overflow-hidden group hover:shadow-md hover:ring-expense/30 transition-all text-left active:scale-[0.98]"
                aria-label={`지출 ${monthlyStats.expense.toLocaleString()}원 보기`}
              >
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" aria-hidden="true">
                    <span className="text-3xl sm:text-4xl text-expense">↗</span>
                 </div>
                 <p className="text-xs sm:text-sm font-medium text-muted-foreground">지출</p>
                 <p className="text-[clamp(18px,5vw,24px)] font-extrabold tracking-tight truncate w-full">
                   <span className="text-expense">-</span>
                   <AnimatedCurrency value={monthlyStats.expense} type="expense" />
                 </p>
              </button>
            </div>
          )}
        </div>
      </div>



      {/* 리스트 섹션 (인라인 노출) */}
      <div className="px-5 pb-24 -mt-16">
         <div className="bg-card rounded-[32px] p-6 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10 min-h-[300px]">
             <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                <span>거래 내역</span>
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
                   {cycleTransactions.length}건
                </span>
             </h3>
             
             {cycleTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
                   <span className="text-4xl mb-2">🍃</span>
                   <p className="text-sm font-medium">내역이 없어요</p>
                </div>
             ) : (
                <div className="space-y-6">
                   {sortedDates.map(date => (
                      <div key={date}>
                         <h4 className="text-xs font-bold text-muted-foreground mb-2 px-1">
                            {format(parseISO(date), 'd일 EEEE', { locale: ko })}
                         </h4>
                         <div className="space-y-1">
                            {groupedTransactions[date].map(t => (
                               <TransactionItem
                                  key={t.transaction_id}
                                  transaction={t}
                                  categories={categories}
                                  onDelete={handleDeleteRequest}
                                  onEdit={handleEdit}
                               />
                            ))}
                         </div>
                      </div>
                   ))}
                </div>
             )}
         </div>
      </div>

      {/* 삭제 확인 다이얼로그 - 토스 UX 스타일 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl max-w-[320px] p-6">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="text-xl font-bold">이 내역을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground mt-2">
              삭제한 내역은 다시 복구할 수 없어요
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl bg-muted hover:bg-muted/80 border-none font-bold text-foreground">
              닫기
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="flex-1 h-12 rounded-2xl bg-destructive hover:bg-destructive/90 font-bold text-white"
            >
              삭제하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FAB selectedDate={selectedDate} />
    </main>
  );
}
