'use client';

import { type ReactNode, type ElementType } from 'react';
import { cn } from '@/lib/utils';
import {
  optionCardVariants,
  iconBadgeVariants,
} from '@/lib/styles/variants';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface OptionCardProps {
  /** 카드 왼쪽에 표시할 아이콘 */
  icon: ElementType;
  /** 카드 제목 */
  title: string;
  /** 카드 설명 (선택) */
  description?: string;
  /** 활성화 상태 */
  active?: boolean;
  /** 카드 내용 */
  children?: ReactNode;
  className?: string;
}

/**
 * 옵션 카드 컴포넌트
 * 결제방식, 반복설정 등 옵션 섹션에 사용
 */
export default function OptionCard({
  icon: Icon,
  title,
  description,
  active = false,
  children,
  className,
}: OptionCardProps) {
  return (
    <div className={cn(optionCardVariants({ active }), className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className={iconBadgeVariants({ active })}>
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div>
          <Label className="text-base font-bold">{title}</Label>
          {description && (
            <p className="text-xs text-muted-foreground font-medium">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// 서브 컴포넌트: 스위치 포함 헤더
interface OptionCardWithSwitchProps {
  icon: ElementType;
  title: string;
  description?: string;
  active?: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}

function OptionCardWithSwitch({
  icon: Icon,
  title,
  description,
  active = false,
  checked,
  onCheckedChange,
  disabled = false,
  children,
  className,
}: OptionCardWithSwitchProps) {
  return (
    <div className={cn(optionCardVariants({ active }), className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={iconBadgeVariants({ active })}>
            <Icon className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <Label htmlFor="option-switch" className="text-base font-bold cursor-pointer">
              {title}
            </Label>
            {description && (
              <p className="text-xs text-muted-foreground font-medium">{description}</p>
            )}
          </div>
        </div>
        <Switch
          id="option-switch"
          checked={checked}
          onCheckedChange={disabled ? undefined : onCheckedChange}
          disabled={disabled}
          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-secondary scale-110"
        />
      </div>
      {children}
    </div>
  );
}

// Export as compound component
Object.assign(OptionCard, {
  WithSwitch: OptionCardWithSwitch,
});

export { OptionCardWithSwitch };
