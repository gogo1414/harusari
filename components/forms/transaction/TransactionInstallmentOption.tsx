import OptionCard from '@/components/common/OptionCard';
import ToggleButton from '@/components/common/ToggleButton';
import { CreditCard, Calculator } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format';

export interface InstallmentPreviewData {
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
}

interface TransactionInstallmentOptionProps {
  paymentType: 'lumpsum' | 'installment';
  onPaymentTypeChange: (type: 'lumpsum' | 'installment') => void;
  installmentMonths: number;
  onInstallmentMonthsChange: (months: number) => void;
  annualRate: number;
  onAnnualRateChange: (rate: number) => void;
  interestFreeMonths: number;
  onInterestFreeMonthsChange: (months: number) => void;
  installmentPreview: InstallmentPreviewData | null;
}

export default function TransactionInstallmentOption({
  paymentType,
  onPaymentTypeChange,
  installmentMonths,
  onInstallmentMonthsChange,
  annualRate,
  onAnnualRateChange,
  interestFreeMonths,
  onInterestFreeMonthsChange,
  installmentPreview,
}: TransactionInstallmentOptionProps) {
  return (
    <OptionCard
      icon={CreditCard}
      title="결제 방식"
      description="일시불 또는 할부를 선택하세요"
      active={paymentType === 'installment'}
    >
      <ToggleButton.Group
        value={paymentType}
        onChange={(val) => onPaymentTypeChange(val as 'lumpsum' | 'installment')}
        className="mb-4"
      >
        <ToggleButton value="lumpsum" className="flex-1 py-3 text-sm">일시불</ToggleButton>
        <ToggleButton value="installment" className="flex-1 py-3 text-sm">할부 결제</ToggleButton>
      </ToggleButton.Group>

      {/* 할부 옵션 (할부 선택 시) */}
      {paymentType === 'installment' && (
        <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 fade-in duration-300">
          {/* 할부 기간 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-bold">할부 기간</Label>
            <Select
              value={installmentMonths.toString()}
              onValueChange={(val) => onInstallmentMonthsChange(parseInt(val))}
            >
              <SelectTrigger className="h-12 rounded-xl border-border bg-background text-base font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 9, 10, 12, 18, 24, 36].map((m) => (
                  <SelectItem key={m} value={m.toString()}>{m}개월</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 이자율 & 무이자 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-bold">연 이자율 (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={annualRate}
                  onChange={(e) => onAnnualRateChange(parseFloat(e.target.value) || 0)}
                  className="h-12 rounded-xl bg-background text-base font-medium pr-8"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-bold">무이자 개월</Label>
              <Select
                value={interestFreeMonths.toString()}
                onValueChange={(val) => onInterestFreeMonthsChange(parseInt(val))}
              >
                <SelectTrigger className="h-12 rounded-xl border-border bg-background text-base font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">없음</SelectItem>
                  {Array.from({ length: installmentMonths }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {m === installmentMonths ? '전액 무이자' : `${m}개월`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 예상 납입금 미리보기 */}
          {installmentPreview && (
            <div className="bg-primary/5 rounded-2xl p-4 space-y-2 border border-primary/10">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm text-primary">예상 납입금</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm text-muted-foreground">월 납입금 (1회차)</span>
                <span className="text-xl font-extrabold text-foreground">
                  {formatCurrency(installmentPreview.monthlyPayment)}
                </span>
              </div>
              <div className="pt-2 border-t border-primary/10 flex justify-between text-sm">
                <span className="text-muted-foreground">총 이자</span>
                <span className="font-bold text-expense">+{formatCurrency(installmentPreview.totalInterest)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">총 납부액</span>
                <span className="font-bold">{formatCurrency(installmentPreview.totalPayment)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </OptionCard>
  );
}
