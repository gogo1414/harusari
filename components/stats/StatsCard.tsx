import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  /** 제목 아래 한 줄 설명 */
  description?: ReactNode;
  /** 제목 오른쪽 (토글 등) */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** 통계 화면 공용 카드 (섹션 + 제목 연결) */
export default function StatsCard({ title, description, action, children, className, id }: StatsCardProps) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('rounded-3xl border border-border/40 bg-card p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]', className)}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-bold tracking-tight text-foreground">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/** 2~3개 선택지 토글 (버튼 + aria-pressed, 44px 터치 영역) */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('inline-flex rounded-full bg-secondary/60 p-1', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              // 시각 높이 36px + 위아래 확장 히트 영역으로 44px 터치 타깃 확보
              "relative h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']",
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
