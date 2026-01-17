'use client';

import {
  createContext,
  useContext,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { toggleButtonVariants } from '@/lib/styles/variants';

// Context for ToggleButton.Group
interface ToggleGroupContextValue<T extends string> {
  value: T;
  onChange: (value: T) => void;
}

const ToggleGroupContext = createContext<ToggleGroupContextValue<string> | null>(null);

// ToggleButton.Group
interface ToggleGroupProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
  className?: string;
}

function ToggleGroup<T extends string>({
  value,
  onChange,
  children,
  className,
}: ToggleGroupProps<T>) {
  return (
    <ToggleGroupContext.Provider value={{ value, onChange: onChange as unknown as (value: string) => void }}>
      <div className={cn('flex gap-2', className)}>{children}</div>
    </ToggleGroupContext.Provider>
  );
}

// ToggleButton
interface ToggleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: ReactNode;
}

function ToggleButton({ value, children, className, ...props }: ToggleButtonProps) {
  const context = useContext(ToggleGroupContext);

  if (!context) {
    throw new Error('ToggleButton must be used within a ToggleButton.Group');
  }

  const isSelected = context.value === value;

  return (
    <button
      type="button"
      onClick={() => context.onChange(value)}
      className={cn(toggleButtonVariants({ selected: isSelected }), className)}
      {...props}
    >
      {children}
    </button>
  );
}

// Compound component export
export default Object.assign(ToggleButton, {
  Group: ToggleGroup,
});
