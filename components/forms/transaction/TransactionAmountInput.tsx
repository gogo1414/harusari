import { cn } from '@/lib/utils';
import React from 'react';

interface TransactionAmountInputProps {
  type: 'income' | 'expense';
  amount: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTypeChange: (type: 'income' | 'expense') => void;
}

export default function TransactionAmountInput({
  type,
  amount,
  onChange,
  onTypeChange,
}: TransactionAmountInputProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex bg-muted/40 p-1.5 rounded-full mb-6 relative">
        <button
          onClick={() => onTypeChange('expense')}
          className={cn(
            "px-8 py-2.5 rounded-full text-base font-bold transition-all duration-200",
            type === 'expense' 
              ? "bg-background text-expense shadow-sm scale-100" 
              : "text-muted-foreground hover:text-foreground scale-95 opacity-70"
          )}
        >
          지출
        </button>
        <button
          onClick={() => onTypeChange('income')}
          className={cn(
            "px-8 py-2.5 rounded-full text-base font-bold transition-all duration-200",
            type === 'income' 
              ? "bg-background text-income shadow-sm scale-100" 
              : "text-muted-foreground hover:text-foreground scale-95 opacity-70"
          )}
        >
          수입
        </button>
      </div>

      <div className="relative flex items-center justify-center w-full">
        <input
          type="text"
          value={amount}
          onChange={onChange}
          placeholder="0"
          className={cn(
            "w-full bg-transparent text-center text-5xl font-extrabold outline-none placeholder:text-muted-foreground/20 caret-primary transition-colors duration-300",
            type === 'income' ? "text-income" : "text-expense"
          )}
          inputMode="numeric"
          autoFocus
        />
      </div>
      <span className="mt-2 text-lg font-bold text-muted-foreground">원</span>
    </div>
  );
}
