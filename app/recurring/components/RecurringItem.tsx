'use client';

import { Edit2, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/category/IconPicker';
import { format } from 'date-fns';
import type { FixedTransaction, Category } from '@/types/database';

interface FixedTransactionWithCategory extends FixedTransaction {
  categories: Category | null;
}

interface RecurringItemProps {
  item: FixedTransactionWithCategory;
  onEdit: (id: string, isInstallment: boolean) => void;
  onDelete: (id: string) => void;
}

export default function RecurringItem({ item, onEdit, onDelete }: RecurringItemProps) {
  const formatAmount = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount);

  const getEndDescription = (endType: string, endDate: string | null) => {
    if (endType === 'never') return '계속 반복';
    if (!endDate) return '종료일 미지정';
    return `${format(new Date(endDate), 'yyyy.MM.dd')} 종료`;
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${
            item.type === 'income' ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
          }`}>
            <CategoryIcon iconName={item.categories?.icon || 'money'} className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">
              {item.memo || item.categories?.name || '미분류'}
            </h3>
            <p className="text-sm text-muted-foreground">
               {item.categories?.name}
            </p>
          </div>
        </div>
         {/* 버튼 그룹 */}
         <div className="flex items-center gap-1">
           <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
            onClick={() => onEdit(item.fixed_transaction_id, !!item.is_installment)}
            aria-label="고정 내역 수정"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
           <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-95 transition-all"
            onClick={() => onDelete(item.fixed_transaction_id)}
            aria-label="고정 내역 삭제"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
         </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-3 mt-1">
         <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              매월 {item.day}일
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
              {getEndDescription(item.end_type, item.end_date)}
            </span>
         </div>
         <span className={`text-lg font-bold ${
            item.type === 'income' ? 'text-income' : 'text-expense'
         }`}>
           {item.type === 'income' ? '+' : '-'}{formatAmount(item.amount)}원
         </span>
      </div>
    </div>
  );
}
