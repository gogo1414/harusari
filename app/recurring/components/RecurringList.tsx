'use client';

import { Loader2, Repeat as RepeatIcon } from 'lucide-react';
import RecurringItem from './RecurringItem';
import type { FixedTransaction, Category } from '@/types/database';

interface FixedTransactionWithCategory extends FixedTransaction {
  categories: Category | null;
}

interface RecurringListProps {
  isLoading: boolean;
  items: FixedTransactionWithCategory[];
  onEdit: (id: string, isInstallment: boolean) => void;
  onDelete: (id: string) => void;
}

export default function RecurringList({ isLoading, items, onEdit, onDelete }: RecurringListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
         <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
           <RepeatIcon className="h-8 w-8 text-muted-foreground" />
         </div>
         <p className="text-lg font-medium text-muted-foreground">등록된 고정 내역이 없습니다</p>
         <p className="text-sm text-muted-foreground/60 mt-2">
           거래 추가 시 &apos;고정 내역으로 등록&apos;을 선택해보세요
         </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <RecurringItem
          key={item.fixed_transaction_id}
          item={item}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
