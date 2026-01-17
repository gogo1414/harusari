'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserSettings } from '@/app/context/UserSettingsContext';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameDay } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Transaction } from '@/types/database';
import FAB from '@/components/common/FAB';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/lib/toast';
import { getCycleRange, filterByDateRange } from '@/lib/date';
import HomeHeader from '@/components/dashboard/HomeHeader';
import HomeCalendarSection from '@/components/dashboard/HomeCalendarSection';
import HomeTransactionList from '@/components/dashboard/HomeTransactionList';
import HomeDeleteDialog from '@/components/dashboard/HomeDeleteDialog';

export default function HomePage() {
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { settings, categories } = useUserSettings();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    // 같은 날짜 클릭 시 토글 (선택 해제)
    if (selectedDate && isSameDay(date, selectedDate)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/transactions/edit/${id}`);
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
  // Use a fallback if settings is not yet loaded
  const weekStartDay = (settings?.week_start_day === 1 ? 'monday' : 'sunday') as 'monday' | 'sunday';
  const cycleStartDay = settings?.salary_cycle_date || 1;

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
        } else if (selectedDate) {
          setSelectedDate(null);
        } else if (isMenuOpen) {
          setIsMenuOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, deleteDialogOpen, selectedDate, isMenuOpen]);

  return (
    <main className="flex min-h-dvh flex-col bg-background font-sans">
      <HomeHeader
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        onLogout={handleLogout}
      />

      <HomeCalendarSection
        isLoading={isLoading}
        transactions={transactions}
        currentDate={currentMonth}
        setCurrentMonth={setCurrentMonth}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        onEdit={handleEdit}
        onDeleteRequest={handleDeleteRequest}
        onCloseDailyCard={() => setSelectedDate(null)}
        categories={categories}
        monthlyStats={monthlyStats}
        cycleStartDay={cycleStartDay}
        weekStartDay={weekStartDay}
      />

      <HomeTransactionList
        transactions={cycleTransactions}
        categories={categories}
        groupedTransactions={groupedTransactions}
        sortedDates={sortedDates}
        onDeleteRequest={handleDeleteRequest}
        onEdit={handleEdit}
      />

      <HomeDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
      />

      <FAB selectedDate={selectedDate} />
    </main>
  );
}

