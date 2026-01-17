'use client';

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/category/IconPicker';
import { formatCurrency } from '@/lib/format';
import type { Transaction, Category } from '@/types/database';

interface TransactionItemProps {
  transaction: Transaction;
  categories: Category[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** 사이즈 변형 */
  size?: 'sm' | 'md';
  /** 호버 시 액션 버튼 표시 여부 */
  showActionsOnHover?: boolean;
}

/**
 * 거래 아이템 컴포넌트
 * 거래 목록에서 개별 거래를 표시하는데 사용
 */
export default function TransactionItem({
  transaction,
  categories,
  onEdit,
  onDelete,
  size = 'md',
  showActionsOnHover = false,
}: TransactionItemProps) {
  const category = categories.find((c) => c.category_id === transaction.category_id);
  const icon = category?.icon || 'money';
  const name = category?.name || '미분류';

  const iconSize = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10 sm:h-11 sm:w-11';
  const textSize = size === 'sm' ? 'text-sm' : 'text-[15px] sm:text-[16px]';
  const amountSize = size === 'sm' ? 'text-sm' : 'text-[15px] sm:text-[16px]';
  const buttonSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const iconButtonSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className={cn('flex items-center gap-3 sm:gap-4 py-3 group', size === 'sm' && 'py-2')}>
      <CategoryIcon
        iconName={icon}
        className={cn(iconSize, 'shrink-0')}
        variant="squircle"
        showBackground={true}
      />
      <div className="flex-1 min-w-0">
        <p className={cn('font-bold truncate leading-tight mb-0.5', textSize)}>
          {transaction.memo || name}
        </p>
        <div className="flex items-center text-[11px] sm:text-xs text-muted-foreground font-medium gap-1 truncate">
          <span className="shrink-0">
            {format(parseISO(transaction.date), 'M.d (EEE)', { locale: ko })}
          </span>
          <span>·</span>
          <span className="truncate">{name}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <span
          className={cn(
            'block font-bold whitespace-nowrap',
            amountSize,
            transaction.type === 'income' ? 'text-income' : 'text-expense'
          )}
        >
          {transaction.type === 'income' ? '+' : '-'}
          {formatCurrency(transaction.amount)}
        </span>
      </div>
      <div
        className={cn(
          'flex items-center gap-0.5 sm:gap-1 pl-1',
          showActionsOnHover && 'opacity-0 group-hover:opacity-100 transition-opacity'
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(transaction.transaction_id)}
          className={cn(
            buttonSize,
            'text-muted-foreground/40 hover:text-primary hover:bg-primary/10 active:opacity-70 transition-colors'
          )}
          aria-label="수정"
        >
          <Edit2 className={iconButtonSize} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(transaction.transaction_id)}
          className={cn(
            buttonSize,
            'text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 active:opacity-70 transition-colors'
          )}
          aria-label="삭제"
        >
          <Trash2 className={iconButtonSize} />
        </Button>
      </div>
    </div>
  );
}
