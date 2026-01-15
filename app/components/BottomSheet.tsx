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
      snapPoints={[0.55, 0.92]} // Slightly taller starting point
      activeSnapPoint={0.55}
      fadeFromIndex={0}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[480px] flex flex-col rounded-t-[32px] bg-card outline-none shadow-[0_-8px_30px_rgba(0,0,0,0.12)] h-[92vh]">
          {/* 드래그 핸들 */}
          <div className="flex justify-center py-4 bg-card rounded-t-[32px]">
            <div className="h-1.5 w-16 rounded-full bg-muted-foreground/20" />
          </div>

          <div className="flex-1 overflow-y-auto bg-card hide-scrollbar">
            {/* 헤더 */}
            <div className="px-6 pb-6 pt-2">
              <div className="flex items-center justify-between mb-6">
                <Drawer.Title className="text-[26px] font-bold tracking-tight text-foreground">
                  {format(selectedDate, 'M월 d일 EEEE', { locale: ko })}
                </Drawer.Title>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={handleAddTransaction}
                    className="rounded-full bg-primary/10 text-primary hover:bg-primary/20 h-10 w-10"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onClose}
                    className="rounded-full hover:bg-muted h-10 w-10"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* 요약 카드 */}
              <div className="flex gap-3">
                <div className="flex-1 rounded-2xl bg-[#F9FAFB] dark:bg-muted/50 p-5 ring-1 ring-black/5 dark:ring-white/5">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-income shadow-[0_0_8px_rgba(45,180,0,0.4)]" /> 수입
                  </span>
                  <p className="text-xl font-bold text-foreground">
                    {totals.income > 0 ? `+${formatCurrency(totals.income)}` : '0'}
                  </p>
                </div>
                <div className="flex-1 rounded-2xl bg-[#F9FAFB] dark:bg-muted/50 p-5 ring-1 ring-black/5 dark:ring-white/5">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                     <span className="w-2 h-2 rounded-full bg-expense shadow-[0_0_8px_rgba(240,68,82,0.4)]" /> 지출
                  </span>
                  <p className="text-xl font-bold text-foreground">
                    {totals.expense > 0 ? `-${formatCurrency(totals.expense)}` : '0'}
                  </p>
                </div>
              </div>
            </div>

            {/* 거래 목록 */}
            <div className="px-5 pb-10">
              {dayTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-3xl">
                    📝
                  </div>
                  <p className="text-lg font-semibold text-foreground/80 mb-1">내역이 없어요</p>
                  <p className="text-muted-foreground text-sm mb-6">오늘 하루는 어떠셨나요?</p>
                  <Button onClick={handleAddTransaction} size="lg" className="rounded-2xl px-8 shadow-lg shadow-primary/20">
                    내역 추가하기
                  </Button>
                </div>
              ) : (
                <ul className="space-y-4">
                  {dayTransactions.map((transaction) => (
                    <li
                      key={transaction.transaction_id}
                      className="group flex items-center gap-4 py-1"
                    >
                      <div className="relative">
                        <CategoryIcon 
                           iconName={transaction.category_id ? getCategoryIcon(transaction.category_id) : 'money'} 
                           className="h-12 w-12"
                           variant="squircle"
                           showBackground={true}
                        />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-[17px] truncate text-foreground leading-tight">
                            {transaction.memo || getCategoryName(transaction.category_id)}
                          </p>
                        </div>
                        <p className="text-[13px] text-muted-foreground font-medium mt-0.5">
                          {getCategoryName(transaction.category_id)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`block font-bold whitespace-nowrap text-[17px] ${
                            transaction.type === 'income'
                              ? 'text-income'
                              : 'text-foreground' /* 지출은 검정색으로 표시하는게 깔끔할 수 있음, or keep red */
                          }`}
                        >
                          {transaction.type === 'income' ? '+' : ''}
                          {formatCurrency(transaction.amount)}
                        </span>
                        
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEdit(transaction)} className="bg-muted p-1.5 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => onDelete(transaction.transaction_id)} className="bg-muted p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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
