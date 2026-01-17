'use client';

import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { cardVariants, type CardVariantsProps } from '@/lib/styles/variants';

interface SummaryCardProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>,
    CardVariantsProps {
  children: ReactNode;
  /** HTML button type is always 'button' for SummaryCard */
  htmlType?: 'submit' | 'reset' | 'button';
}

/**
 * 수입/지출 요약 카드 컴포넌트
 * 메인 페이지의 수입/지출 요약 표시에 사용
 */
const SummaryCard = forwardRef<HTMLButtonElement, SummaryCardProps>(
  ({ children, className, type, size, interactive = true, htmlType = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={htmlType}
        className={cn(
          cardVariants({ type, size, interactive }),
          'flex flex-col justify-between text-left group',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

SummaryCard.displayName = 'SummaryCard';

// 서브 컴포넌트: 배지 아이콘
interface BadgeProps {
  children: ReactNode;
  type?: 'income' | 'expense';
}

function Badge({ children, type = 'income' }: BadgeProps) {
  return (
    <div
      className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"
      aria-hidden="true"
    >
      <span
        className={cn(
          'text-3xl sm:text-4xl',
          type === 'income' ? 'text-income' : 'text-expense'
        )}
      >
        {children}
      </span>
    </div>
  );
}

// 서브 컴포넌트: 라벨
interface LabelProps {
  children: ReactNode;
}

function Label({ children }: LabelProps) {
  return (
    <p className="text-xs sm:text-sm font-medium text-muted-foreground">
      {children}
    </p>
  );
}

// 서브 컴포넌트: 금액
interface AmountProps {
  children: ReactNode;
  type?: 'income' | 'expense';
  prefix?: string;
}

function Amount({ children, type = 'income', prefix }: AmountProps) {
  return (
    <p className="text-[clamp(18px,5vw,24px)] font-extrabold tracking-tight truncate w-full">
      {prefix && (
        <span className={type === 'income' ? 'text-income' : 'text-expense'}>
          {prefix}
        </span>
      )}
      {children}
    </p>
  );
}

// Compound component 패턴으로 export
export default Object.assign(SummaryCard, {
  Badge,
  Label,
  Amount,
});
