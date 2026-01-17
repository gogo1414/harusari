'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ChevronLeft, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from '@/types/database';
import { CategoryIcon } from '@/components/category/IconPicker';
import { calculateInstallment } from '@/lib/installment';
import { formatCurrency } from '@/lib/format';
import { ko } from 'date-fns/locale';

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

const MONTH_OPTIONS = [2, 3, 4, 5, 6, 9, 10, 12, 18, 24, 36, 48, 60];

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

  const handleCategorySelect = (categoryId: string) => {
    setFormData(prev => ({ ...prev, category_id: categoryId }));
    setIsCategoryOpen(false);
  };

  const currentCategory = categories.find(c => c.category_id === formData.category_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category_id || formData.principal <= 0) return;
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-background max-w-md mx-auto relative">
      {/* 헤더 */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-10 w-10 -ml-2 rounded-full hover:bg-muted"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">{isEditMode ? '할부 수정' : '할부 등록'}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-32 space-y-8">
        {/* 금액 입력 */}
        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-2">할부 원금</label>
          <div className="relative">
            <input
              type="text"
              value={amountString}
              onChange={handleAmountChange}
              placeholder="0"
              className="w-full text-4xl font-extrabold bg-transparent border-none p-0 focus:ring-0 placeholder:text-muted-foreground/30"
              autoFocus
              inputMode="numeric"
            />
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">원</span>
          </div>
        </div>

        {/* 할부 정보 설정 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">할부 기간</label>
            <Select
              value={formData.months.toString()}
              onValueChange={(val) => setFormData(prev => ({ ...prev, months: parseInt(val) }))}
            >
              <SelectTrigger className="h-12 rounded-xl border-border bg-card text-lg font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map(m => (
                  <SelectItem key={m} value={m.toString()}>{m}개월</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">연 이자율 (%)</label>
            <div className="relative">
              <input
                type="number"
                value={formData.annualRate}
                onChange={(e) => setFormData(prev => ({ ...prev, annualRate: parseFloat(e.target.value) || 0 }))}
                className="flex h-12 w-full rounded-xl border border-input bg-card px-3 py-2 text-lg font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-right pr-8"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        {/* 무이자 설정 */}
        <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">무이자 적용 (선택)</label>
            <Select
              value={formData.interestFreeMonths.toString()}
              onValueChange={(val) => setFormData(prev => ({ ...prev, interestFreeMonths: parseInt(val) }))}
            >
              <SelectTrigger className="h-12 rounded-xl border-border bg-card text-base text-muted-foreground font-medium">
                <SelectValue placeholder="무이자 없음" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">무이자 없음 (전체 유이자)</SelectItem>
                {Array.from({ length: formData.months }, (_, i) => i + 1).map(m => (
                    <SelectItem key={m} value={m.toString()}>{m === formData.months ? '전액 무이자' : `${m}개월 무이자`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
        </div>

        {/* 계산 결과 미리보기 */}
        {calculation && (
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
        )}

        {/* 카테고리 & 날짜 & 내용 */}
        <div className="space-y-4">
            {/* 카테고리 */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">카테고리</label>
                <button
                    type="button"
                    onClick={() => setIsCategoryOpen(true)}
                    className="flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left shadow-sm hover:bg-muted/50 transition-colors"
                >
                    <CategoryIcon
                        iconName={currentCategory?.icon || 'help_circle'}
                        className="h-10 w-10 text-muted-foreground"
                        showBackground={true}
                    />
                    <span className={cn("text-lg font-medium", !currentCategory && "text-muted-foreground")}>
                        {currentCategory?.name || '카테고리 선택'}
                    </span>
                </button>
            </div>

            {/* 나머지 입력 필드들 */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">결제 시작일</label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full h-12 justify-start text-left font-normal rounded-xl text-base px-3",
                                    !formData.date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formData.date ? format(formData.date, "M월 d일 (EEE)", { locale: ko }) : <span>날짜 선택</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={formData.date}
                                onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">내용</label>
                    <input
                        type="text"
                        value={formData.memo}
                        onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
                        placeholder="예: 아이폰 15"
                        className="flex h-12 w-full rounded-xl border border-input bg-card px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
            </div>
        </div>
      </div>

       {/* 하단 버튼 */}
       <div className="absolute bottom-0 left-0 right-0 p-5 bg-background/80 backdrop-blur-md border-t">
        <Button 
            type="submit" 
            className="w-full h-14 text-lg rounded-2xl font-bold shadow-lg shadow-primary/20" 
            disabled={!formData.category_id || formData.principal <= 0 || isSubmitting}
        >
          {isSubmitting ? (
             <span className="flex items-center gap-2">
               <span className="animate-spin text-xl">⏳</span> 저장 중...
             </span>
          ) : (
             isEditMode ? '할부 수정하기' : '할부 등록하기'
          )}
        </Button>
      </div>

       {/* 카테고리 선택 다이얼로그 */}
       <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>카테고리 선택</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-4 py-4">
               {categories.map((cat) => (
                 <button
                   key={cat.category_id}
                   onClick={() => handleCategorySelect(cat.category_id)}
                   className="flex flex-col items-center gap-2"
                 >
                   <CategoryIcon 
                      iconName={cat.icon} 
                      className={cn(
                        "h-12 w-12 transition-all",
                        formData.category_id === cat.category_id ? "ring-2 ring-primary ring-offset-2 rounded-xl" : "opacity-70"
                      )}
                      variant="squircle"
                      showBackground
                   />
                   <span className={cn(
                     "text-xs truncate w-full text-center",
                     formData.category_id === cat.category_id ? "font-bold text-primary" : "text-muted-foreground"
                   )}>
                     {cat.name}
                   </span>
                 </button>
               ))}
            </div>
            <div className="flex justify-end">
               <DialogClose asChild>
                  <Button variant="ghost">닫기</Button>
               </DialogClose>
            </div>
          </DialogContent>
       </Dialog>
    </form>
  );
}
