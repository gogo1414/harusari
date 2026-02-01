'use client';

import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TransactionSubmitButtonProps {
  type: 'income' | 'expense';
  amount: number | string;
  isValid: boolean;
  isLoading: boolean;
  isEditMode: boolean;
  onSubmit: () => void;
}

export default function TransactionSubmitButton({
  type,
  amount,
  isValid,
  isLoading,
  isEditMode,
  onSubmit
}: TransactionSubmitButtonProps) {
  return (
    <div className="p-4 bg-background/80 backdrop-blur-md sticky bottom-0 z-20">
      <Button 
        className={cn(
            "w-full h-14 rounded-2xl text-lg font-bold shadow-lg transition-all active:scale-[0.98]",
            type === 'income' ? "shadow-income/20 hover:bg-income/90 bg-income" : "shadow-expense/20 hover:bg-expense/90 bg-expense"
        )}
        size="lg"
        onClick={onSubmit}
        disabled={!isValid || isLoading}
      >
        {isLoading ? (
           <span className="flex items-center gap-2">
               <Loader2 className="animate-spin h-5 w-5" /> 저장 중...
           </span>
        ) : (
           <span className="flex items-center gap-2">
             <Check className="w-6 h-6" strokeWidth={3} /> 
             {amount ? `${amount}원 ${isEditMode ? '수정' : '저장'}` : (isEditMode ? '수정하기' : '저장하기')}
           </span>
        )}
      </Button>
    </div>
  );
}
