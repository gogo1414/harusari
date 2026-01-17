import { cva, type VariantProps } from 'class-variance-authority';

/**
 * 카드 스타일 변형
 * 수입/지출/기본 카드에 사용
 */
export const cardVariants = cva(
  'rounded-[24px] bg-card p-4 sm:p-5 shadow-sm ring-1 transition-all relative overflow-hidden',
  {
    variants: {
      type: {
        income: 'ring-black/5 dark:ring-white/5 hover:ring-income/30 hover:shadow-md',
        expense: 'ring-black/5 dark:ring-white/5 hover:ring-expense/30 hover:shadow-md',
        default: 'ring-black/5 dark:ring-white/5',
      },
      size: {
        sm: 'h-[80px]',
        md: 'h-[100px] sm:h-[110px]',
        lg: 'h-[120px]',
      },
      interactive: {
        true: 'cursor-pointer active:scale-[0.98]',
        false: '',
      },
    },
    defaultVariants: {
      type: 'default',
      size: 'md',
      interactive: false,
    },
  }
);

export type CardVariantsProps = VariantProps<typeof cardVariants>;

/**
 * 토글 버튼 스타일 변형
 * 일시불/할부, 계속반복/날짜지정 등에 사용
 */
export const toggleButtonVariants = cva(
  'flex-1 rounded-xl py-3 text-sm font-bold transition-all',
  {
    variants: {
      selected: {
        true: 'bg-primary/10 text-primary ring-1 ring-primary/20',
        false: 'bg-muted/50 text-muted-foreground hover:bg-muted',
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export type ToggleButtonVariantsProps = VariantProps<typeof toggleButtonVariants>;

/**
 * 세그먼트 컨트롤 아이템 스타일 변형
 * 수입/지출 토글에 사용
 */
export const segmentVariants = cva(
  'rounded-2xl py-2.5 text-sm font-bold transition-all duration-300',
  {
    variants: {
      type: {
        expense: 'text-expense',
        income: 'text-income',
      },
      selected: {
        true: 'bg-white dark:bg-card shadow-sm',
        false: 'bg-transparent text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5',
      },
    },
    compoundVariants: [
      {
        selected: false,
        className: 'text-muted-foreground',
      },
    ],
    defaultVariants: {
      selected: false,
    },
  }
);

export type SegmentVariantsProps = VariantProps<typeof segmentVariants>;

/**
 * 옵션 카드 스타일 변형
 * 결제방식, 반복설정 카드에 사용
 */
export const optionCardVariants = cva(
  'rounded-2xl p-5 space-y-4 transition-all duration-300 bg-card shadow-md',
  {
    variants: {
      active: {
        true: 'ring-2 ring-primary shadow-lg shadow-primary/20',
        false: 'ring-1 ring-border/80',
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

export type OptionCardVariantsProps = VariantProps<typeof optionCardVariants>;

/**
 * 아이콘 배지 스타일 변형
 * 옵션 카드 내 아이콘에 사용
 */
export const iconBadgeVariants = cva(
  'flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300',
  {
    variants: {
      active: {
        true: 'bg-primary text-white shadow-lg shadow-primary/30',
        false: 'bg-secondary text-primary',
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

export type IconBadgeVariantsProps = VariantProps<typeof iconBadgeVariants>;

/**
 * 거래 아이템 금액 색상
 */
export const amountColorVariants = cva('font-bold', {
  variants: {
    type: {
      income: 'text-income',
      expense: 'text-expense',
    },
  },
});

export type AmountColorVariantsProps = VariantProps<typeof amountColorVariants>;

/**
 * 메뉴 아이템 애니메이션 variants (framer-motion)
 */
export const menuItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.08, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};
