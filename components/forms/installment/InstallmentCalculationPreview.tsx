import { Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface CalculationResult {
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
  interestFreeMonths?: number;
}

interface InstallmentCalculationPreviewProps {
  calculation: CalculationResult | null;
}

export default function InstallmentCalculationPreview({ calculation }: InstallmentCalculationPreviewProps) {
  if (!calculation) return null;

  return (
    <div className="bg-primary/5 rounded-2xl p-5 space-y-3 border border-primary/10">
      <div className="flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5 text-primary" />
          <span className="font-bold text-primary">예상 납입금</span>
      </div>
      
      <div className="flex justify-between items-end">
          <span className="text-sm text-muted-foreground font-medium">월 납입금</span>
          <span className="text-2xl font-extrabold text-foreground">
              {formatCurrency(calculation.monthlyPayment)}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ 월</span>
          </span>
      </div>

      <div className="pt-3 border-t border-primary/10 flex justify-between text-sm">
          <span className="text-muted-foreground">총 이자</span>
          <span className="font-bold text-expense">+{formatCurrency(calculation.totalInterest)}</span>
      </div>
       <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">총 납부액</span>
          <span className="font-bold">{formatCurrency(calculation.totalPayment)}</span>
      </div>
    </div>
  );
}
