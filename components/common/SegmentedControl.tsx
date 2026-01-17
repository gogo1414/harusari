'use client';

import { cn } from '@/lib/utils';
import { segmentVariants } from '@/lib/styles/variants';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** 최대 너비 (기본: 280px) */
  maxWidth?: string;
  className?: string;
}

/**
 * 세그먼트 컨트롤 컴포넌트
 * 수입/지출 토글 등에 사용
 */
export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  maxWidth = '280px',
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('flex justify-center', className)}>
      <div
        className="grid gap-0 rounded-[20px] bg-muted/60 p-1.5 w-full"
        style={{
          maxWidth,
          gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        }}
      >
        {options.map((option) => {
          const isSelected = value === option.value;
          const type = option.value as 'income' | 'expense' | undefined;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={segmentVariants({
                type: type === 'income' || type === 'expense' ? type : undefined,
                selected: isSelected,
              })}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
