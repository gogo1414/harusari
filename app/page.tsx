'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Settings, LogOut, List, Repeat, ChevronRight } from 'lucide-react';
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

// 더미 데이터
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

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setIsBottomSheetOpen(true);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
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
            
            <DropdownMenuItem asChild className="rounded-lg p-2 focus:bg-muted">
              <Link href="/categories" className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  <span>카테고리 관리</span>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="rounded-lg p-2 focus:bg-muted">
              <Link href="/recurring" className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4" />
                  <span>고정 지출 관리</span>
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
          <Calendar
            transactions={dummyTransactions}
            onDateSelect={handleDateSelect}
            selectedDate={selectedDate || undefined}
          />
        </div>
        
        {/* 간단한 월 요약 카드 (추가) */}
        <div className="mt-6 grid grid-cols-2 gap-4 px-2">
          <div className="rounded-2xl bg-income/10 p-4 text-center">
            <p className="text-xs font-medium text-income/80">이번 달 수입</p>
            <p className="mt-1 text-lg font-bold text-income">3,000,000원</p>
          </div>
          <div className="rounded-2xl bg-expense/10 p-4 text-center">
            <p className="text-xs font-medium text-expense/80">이번 달 지출</p>
            <p className="mt-1 text-lg font-bold text-expense">50,000원</p>
          </div>
        </div>
      </div>

      <BottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        selectedDate={selectedDate}
        transactions={dummyTransactions}
        categories={dummyCategories}
        onEdit={() => {}}
        onDelete={() => {}}
      />

      <FAB />
    </main>
  );
}
