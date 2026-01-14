'use client';

import { Drawer } from 'vaul';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Edit2, Trash2 } from 'lucide-react';
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

// 금액 포맷팅 (콤마)
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

  // 해당 날짜의 거래 필터링
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayTransactions = transactions.filter((t) => t.date === dateStr);

  // 수입/지출 합계
  const totals = dayTransactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  // 카테고리 아이콘 찾기
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
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] rounded-t-2xl bg-card outline-none">
          {/* 드래그 핸들 */}
          <div className="flex justify-center py-3">
            <div className="h-1.5 w-12 rounded-full bg-muted" />
          </div>

          {/* 헤더 */}
          <div className="border-b border-border px-4 pb-3">
            <Drawer.Title className="text-lg font-semibold">
              {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
            </Drawer.Title>

            {/* 요약 */}
            <div className="mt-2 flex gap-4 text-sm">
              {totals.income > 0 && (
                <span className="text-income">
                  수입 +{formatCurrency(totals.income)}원
                </span>
              )}
              {totals.expense > 0 && (
                <span className="text-expense">
                  지출 -{formatCurrency(totals.expense)}원
                </span>
              )}
              {totals.income === 0 && totals.expense === 0 && (
                <span className="text-muted-foreground">내역이 없습니다</span>
              )}
            </div>
          </div>

          {/* 거래 목록 */}
          <div className="max-h-[50vh] overflow-y-auto px-4 py-2">
            {dayTransactions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                이 날짜에 등록된 내역이 없습니다
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {dayTransactions.map((transaction) => (
                  <li
                    key={transaction.transaction_id}
                    className="flex items-center gap-3 py-3"
                  >
                    {/* 카테고리 아이콘 */}
                    <span className="text-2xl">
                      {getCategoryIcon(transaction.category_id)}
                    </span>

                    {/* 내용 */}
                    <div className="flex-1">
                      <p className="font-medium">
                        {getCategoryName(transaction.category_id)}
                      </p>
                      {transaction.memo && (
                        <p className="text-sm text-muted-foreground">
                          {transaction.memo}
                        </p>
                      )}
                    </div>

                    {/* 금액 */}
                    <span
                      className={`font-semibold ${
                        transaction.type === 'income'
                          ? 'text-income'
                          : 'text-expense'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}원
                    </span>

                    {/* 액션 버튼 */}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(transaction)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => onDelete(transaction.transaction_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 하단 여백 (Safe Area) */}
          <div className="h-6" />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
