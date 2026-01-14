'use client';

import { Drawer } from 'vaul';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Edit2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Transaction, Category } from '@/types/database';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  transactions: Transaction[];
  categories: Category[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

export default function BottomSheet({
  isOpen,
  onClose,
  selectedDate,
  transactions,
  categories,
  onEdit,
  onDelete,
}: BottomSheetProps) {
  if (!selectedDate) return null;

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayTransactions = transactions.filter((t) => t.date === dateStr);

  const totals = dayTransactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const getCategoryIcon = (categoryId: string | null) => {
    if (!categoryId) return '💰';
    const category = categories.find((c) => c.category_id === categoryId);
    return category?.icon || '💰';
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '미분류';
    const category = categories.find((c) => c.category_id === categoryId);
    return category?.name || '미분류';
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] flex flex-col rounded-t-[28px] bg-card outline-none shadow-2xl">
          {/* 드래그 핸들 */}
          <div className="flex justify-center py-4">
            <div className="h-1.5 w-12 rounded-full bg-muted/80" />
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* 헤더 */}
            <div className="px-6 pb-6 mt-2">
              <div className="flex items-center justify-between">
                <Drawer.Title className="text-2xl font-bold tracking-tight">
                  {format(selectedDate, 'M월 d일 EEEE', { locale: ko })}
                </Drawer.Title>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose}
                  className="rounded-full hover:bg-muted"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </Button>
              </div>

              {/* 요약 카드 */}
              <div className="mt-4 flex gap-4">
                <div className="flex-1 rounded-2xl bg-muted/50 p-4">
                  <span className="text-xs font-medium text-muted-foreground">수입</span>
                  <p className={`mt-1 text-lg font-bold ${totals.income > 0 ? 'text-income' : 'text-muted-foreground'}`}>
                    {totals.income > 0 ? `+${formatCurrency(totals.income)}` : '0'}
                  </p>
                </div>
                <div className="flex-1 rounded-2xl bg-muted/50 p-4">
                  <span className="text-xs font-medium text-muted-foreground">지출</span>
                  <p className={`mt-1 text-lg font-bold ${totals.expense > 0 ? 'text-expense' : 'text-muted-foreground'}`}>
                    {totals.expense > 0 ? `-${formatCurrency(totals.expense)}` : '0'}
                  </p>
                </div>
              </div>
            </div>

            {/* 거래 목록 */}
            <div className="px-4 pb-10">
              {dayTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="text-4xl mb-4">📝</span>
                  <p className="text-muted-foreground font-medium">작성된 내역이 없어요</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {dayTransactions.map((transaction) => (
                    <li
                      key={transaction.transaction_id}
                      className="group flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-4 transition-all hover:bg-muted/30"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-2xl">
                        {getCategoryIcon(transaction.category_id)}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {transaction.memo || getCategoryName(transaction.category_id)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {getCategoryName(transaction.category_id)}
                          {/* 고정 지출 표시 등 추후 추가 */}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`block font-bold whitespace-nowrap ${
                            transaction.type === 'income'
                              ? 'text-income'
                              : 'text-expense'
                          }`}
                        >
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </span>
                        
                        {/* 액션 버튼들 (호버 시 표시하거나, 스와이프로 구현 가능) -> 일단 작게 표시 */}
                        <div className="mt-1 flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEdit(transaction)} className="p-1 text-muted-foreground hover:text-foreground">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => onDelete(transaction.transaction_id)} className="p-1 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
