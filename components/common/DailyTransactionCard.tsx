'use client';

import { useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Edit2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/category/IconPicker';
import { formatCurrency } from '@/lib/format';
import type { Transaction, Category } from '@/types/database';

interface DailyTransactionCardProps {
  date: Date;
  transactions: Transaction[];
  categories: Category[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

/**
 * 선택된 날짜의 거래 내역을 표시하는 인라인 카드
 */
export default function DailyTransactionCard({
  date,
  transactions,
  categories,
  onEdit,
  onDelete,
  onClose,
}: DailyTransactionCardProps) {
  // 해당 날짜의 거래만 필터링
  const dayTransactions = useMemo(() => {
    return transactions.filter((t) => isSameDay(parseISO(t.date), date));
  }, [transactions, date]);

  // 수입/지출 합계 계산
  const { income, expense } = useMemo(() => {
    return dayTransactions.reduce(
      (acc, t) => {
        if (t.type === 'income') acc.income += t.amount;
        else acc.expense += t.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [dayTransactions]);

  const getCategoryInfo = (categoryId: string | null) => {
    const category = categories.find((c) => c.category_id === categoryId);
    return {
      icon: category?.icon || 'money',
      name: category?.name || '미분류',
    };
  };

  if (dayTransactions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mt-4 rounded-[24px] bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold">
            📅 {format(date, 'M월 d일 (EEE)', { locale: ko })}
          </h3>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 px-3 text-muted-foreground hover:text-foreground"
            >
              닫기
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          이 날짜에 거래 내역이 없어요
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mt-4 rounded-[24px] bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold">
          📅 {format(date, 'M월 d일 (EEE)', { locale: ko })}
        </h3>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 px-3 text-muted-foreground hover:text-foreground"
          >
            닫기
          </Button>
        )}
      </div>

      {/* 요약 */}
      <div className="flex gap-4 mb-4">
        {income > 0 && (
          <div className="flex-1 rounded-2xl bg-income/10 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">수입</p>
            <p className="text-lg font-bold text-income">+{formatCurrency(income)}</p>
          </div>
        )}
        {expense > 0 && (
          <div className="flex-1 rounded-2xl bg-expense/10 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">지출</p>
            <p className="text-lg font-bold text-expense">-{formatCurrency(expense)}</p>
          </div>
        )}
      </div>

      {/* 거래 목록 */}
      <div className="space-y-2">
        {dayTransactions.map((t) => {
          const { icon, name } = getCategoryInfo(t.category_id);
          return (
            <div
              key={t.transaction_id}
              className="flex items-center gap-3 py-2 group"
            >
              <CategoryIcon
                iconName={icon}
                className="h-9 w-9 shrink-0"
                variant="squircle"
                showBackground={true}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {t.memo || name}
                </p>
                <p className="text-xs text-muted-foreground">{name}</p>
              </div>
              <span
                className={`font-bold text-sm ${
                  t.type === 'income' ? 'text-income' : 'text-expense'
                }`}
              >
                {t.type === 'income' ? '+' : '-'}
                {formatCurrency(t.amount)}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(t.transaction_id)}
                  className="h-7 w-7 text-muted-foreground/60 hover:text-primary"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(t.transaction_id)}
                  className="h-7 w-7 text-muted-foreground/60 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
