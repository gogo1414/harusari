'use client';

import { useState, useMemo } from 'react';
import { calculateInstallment } from '@/lib/installment';
import type { Category } from '@/types/database';

import InstallmentHeader from './installment/InstallmentHeader';
import InstallmentAmountInput from './installment/InstallmentAmountInput';
import InstallmentConfigSection from './installment/InstallmentConfigSection';
import InstallmentCalculationPreview from './installment/InstallmentCalculationPreview';
import InstallmentCategorySelect from './installment/InstallmentCategorySelect';
import InstallmentDateMemoSection from './installment/InstallmentDateMemoSection';
import InstallmentSubmitButton from './installment/InstallmentSubmitButton';

export interface InstallmentFormData {
  date: Date;             // 결제 시작일
  principal: number;      // 할부 원금
  months: number;         // 할부 기간
  annualRate: number;     // 연 이자율 (%)
  interestFreeMonths: number; // 무이자 개월 수
  category_id: string;    // 카테고리
  memo: string;           // 내용 (상품명)
}

interface InstallmentFormProps {
  categories: Category[];
  onSubmit: (data: InstallmentFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialData?: InstallmentFormData;
  isEditMode?: boolean;
}

export default function InstallmentForm({
  categories,
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialData,
  isEditMode = false,
}: InstallmentFormProps) {
  const [formData, setFormData] = useState<InstallmentFormData>({
    date: initialData?.date || new Date(),
    principal: initialData?.principal || 0,
    months: initialData?.months || 3,
    annualRate: initialData?.annualRate || 0,
    interestFreeMonths: initialData?.interestFreeMonths || 0,
    category_id: initialData?.category_id || categories[0]?.category_id || '',
    memo: initialData?.memo || '',
  });

  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [amountString, setAmountString] = useState(
    initialData?.principal ? initialData.principal.toLocaleString() : ''
  );

  // 입력값 변경 시 자동 계산 (useMemo)
  const calculation = useMemo(() => {
    if (formData.principal > 0 && formData.months > 0) {
      return calculateInstallment({
        principal: formData.principal,
        months: formData.months,
        annualRate: formData.annualRate,
        interestFreeMonths: formData.interestFreeMonths
      });
    }
    return null;
  }, [formData.principal, formData.months, formData.annualRate, formData.interestFreeMonths]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value === '') {
        setAmountString('');
        setFormData(prev => ({ ...prev, principal: 0 }));
        return;
    }
    
    const numValue = parseInt(value, 10);
    setAmountString(numValue.toLocaleString());
    setFormData(prev => ({ ...prev, principal: numValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category_id || formData.principal <= 0) return;
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-background max-w-md mx-auto relative">
      <InstallmentHeader isEditMode={isEditMode} onCancel={onCancel} />

      <div className="flex-1 overflow-y-auto p-5 pb-32 space-y-8">
        <InstallmentAmountInput 
          amountString={amountString} 
          onChange={handleAmountChange} 
        />

        <InstallmentConfigSection
            months={formData.months}
            annualRate={formData.annualRate}
            interestFreeMonths={formData.interestFreeMonths}
            onMonthsChange={(months) => setFormData(prev => ({ ...prev, months }))}
            onAnnualRateChange={(rate) => setFormData(prev => ({ ...prev, annualRate: rate }))}
            onInterestFreeMonthsChange={(months) => setFormData(prev => ({ ...prev, interestFreeMonths: months }))}
        />

        <InstallmentCalculationPreview calculation={calculation} />

        <div className="space-y-4">
            <InstallmentCategorySelect
                categoryId={formData.category_id}
                categories={categories}
                isCategoryOpen={isCategoryOpen}
                setIsCategoryOpen={setIsCategoryOpen}
                onCategorySelect={(id) => {
                    setFormData(prev => ({ ...prev, category_id: id }));
                    setIsCategoryOpen(false);
                }}
            />

            <InstallmentDateMemoSection
                date={formData.date}
                memo={formData.memo}
                onDateChange={(date) => date && setFormData(prev => ({ ...prev, date }))}
                onMemoChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
            />
        </div>
      </div>

      <InstallmentSubmitButton
        isSubmitting={isSubmitting}
        isEditMode={isEditMode}
        disabled={!formData.category_id || formData.principal <= 0 || isSubmitting}
      />
    </form>
  );
}
