import React from 'react';

interface InstallmentAmountInputProps {
  amountString: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function InstallmentAmountInput({ amountString, onChange }: InstallmentAmountInputProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-muted-foreground mb-2">할부 원금</label>
      <div className="relative">
        <input
          type="text"
          value={amountString}
          onChange={onChange}
          placeholder="0"
          className="w-full text-4xl font-extrabold bg-transparent border-none p-0 focus:ring-0 placeholder:text-muted-foreground/30"
          autoFocus
          inputMode="numeric"
        />
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">원</span>
      </div>
    </div>
  );
}
