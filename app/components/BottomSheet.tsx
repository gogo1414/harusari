'use client';

import { Drawer } from 'vaul';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Edit2, Trash2, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import type { Transaction, Category } from '@/types/database';
import { CategoryIcon } from './IconPicker';

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
  const router = useRouter();

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

  const handleAddTransaction = () => {
     router.push(`/transactions/new?date=${dateStr}`);
  };

  return (
    <Drawer.Root 
      open={isOpen} 
      onOpenChange={(open) => !open && onClose()}
      snapPoints={[0.5, 0.85]} // 50% 높이에서 시작, 당기면 85%까지 확장
      activeSnapPoint={0.5}
      fadeFromIndex={0}
    >
      <Drawer.Portal>
        {/* z-index를 50으로 높여서 헤더(z-10)를 확실히 덮도록 수정 */}
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[480px] flex flex-col rounded-t-[28px] bg-card outline-none shadow-2xl h-[85vh]">
          {/* 드래그 핸들 */}
          <div className="flex justify-center py-4 bg-card rounded-t-[28px]">
            <div className="h-1.5 w-12 rounded-full bg-muted/80" />
          </div>

          <div className="flex-1 overflow-y-auto bg-card">
            {/* 헤더 */}
            <div className="px-6 pb-6 mt-2">
              <div className="flex items-center justify-between">
                <Drawer.Title className="text-2xl font-bold tracking-tight">
                  {format(selectedDate, 'M월 d일 EEEE', { locale: ko })}
                </Drawer.Title>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="icon"
                    onClick={handleAddTransaction}
                    className="rounded-full border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onClose}
                    className="rounded-full hover:bg-muted"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* 요약 카드 */}
              <div className="mt-6 flex gap-4">
                <div className="flex-1 rounded-2xl bg-income/10 p-4 ring-1 ring-income/20">
                  <span className="text-xs font-bold text-income flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-income" /> 수입
                  </span>
                  <p className="mt-1 text-lg font-bold text-income">
                    {totals.income > 0 ? `+${formatCurrency(totals.income)}` : '0'}
                  </p>
                </div>
                <div className="flex-1 rounded-2xl bg-expense/10 p-4 ring-1 ring-expense/20">
                  <span className="text-xs font-bold text-expense flex items-center gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-expense" /> 지출
                  </span>
                  <p className="mt-1 text-lg font-bold text-expense">
                    {totals.expense > 0 ? `-${formatCurrency(totals.expense)}` : '0'}
                  </p>
                </div>
              </div>
            </div>

            {/* 거래 목록 */}
            <div className="px-4 pb-10">
              {dayTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="text-5xl mb-4 grayscale opacity-50">💸</span>
                  <p className="text-muted-foreground font-medium mb-4">내역이 없습니다</p>
                  <Button onClick={handleAddTransaction} className="rounded-xl">
                    새 내역 추가하기
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {dayTransactions.map((transaction) => (
                    <li
                      key={transaction.transaction_id}
                      className="group flex items-center gap-4 rounded-2xl border border-border/40 bg-card p-4 transition-all hover:bg-muted/30 hover:border-primary/20 hover:shadow-sm"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-2xl">
                        <CategoryIcon iconName={transaction.category_id ? getCategoryIcon(transaction.category_id) : 'money'} className="h-6 w-6 text-primary" />
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-foreground/90">
                          {transaction.memo || getCategoryName(transaction.category_id)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                          {getCategoryName(transaction.category_id)}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`block font-bold whitespace-nowrap text-[15px] ${
                            transaction.type === 'income'
                              ? 'text-income'
                              : 'text-expense'
                          }`}
                        >
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </span>
                        
                        <div className="mt-1 flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEdit(transaction)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => onDelete(transaction.transaction_id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors">
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
