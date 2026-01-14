'use client';

import { useState } from 'react';
import Calendar from './components/Calendar';
import BottomSheet from './components/BottomSheet';
import FAB from './components/FAB';
import { Button } from '@/components/ui/button';
import type { Transaction, Category } from '@/types/database';

// 임시 더미 데이터 (나중에 Supabase에서 가져옴)
const dummyTransactions: Transaction[] = [
  {
    transaction_id: '1',
    user_id: 'user1',
    amount: 50000,
    type: 'expense',
    category_id: 'cat1',
    date: new Date().toISOString().split('T')[0],
    memo: '점심 식사',
    source_fixed_id: null,
    created_at: new Date().toISOString(),
  },
  {
    transaction_id: '2',
    user_id: 'user1',
    amount: 3000000,
    type: 'income',
    category_id: 'cat2',
    date: new Date().toISOString().split('T')[0],
    memo: '월급',
    source_fixed_id: null,
    created_at: new Date().toISOString(),
  },
];

const dummyCategories: Category[] = [
  {
    category_id: 'cat1',
    user_id: 'user1',
    name: '식비',
    type: 'expense',
    icon: '🍔',
    created_at: new Date().toISOString(),
  },
  {
    category_id: 'cat2',
    user_id: 'user1',
    name: '급여',
    type: 'income',
    icon: '💼',
    created_at: new Date().toISOString(),
  },
];

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // 날짜 선택 핸들러
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setIsBottomSheetOpen(true);
  };

  // 거래 수정 핸들러 (추후 구현)
  const handleEditTransaction = (transaction: Transaction) => {
    console.log('Edit:', transaction);
    // TODO: 수정 페이지로 이동
  };

  // 거래 삭제 핸들러 (추후 구현)
  const handleDeleteTransaction = (transactionId: string) => {
    console.log('Delete:', transactionId);
    // TODO: 삭제 확인 다이얼로그
  };

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h1 className="text-xl font-bold text-primary">하루살이</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={async () => {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
        >
          로그아웃
        </Button>
      </header>

      {/* 달력 */}
      <Calendar
        transactions={dummyTransactions}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate || undefined}
      />

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        selectedDate={selectedDate}
        transactions={dummyTransactions}
        categories={dummyCategories}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
      />

      {/* FAB */}
      <FAB />
    </main>
  );
}
