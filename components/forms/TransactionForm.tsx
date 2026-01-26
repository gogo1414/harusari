'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { calculateInstallment } from '@/lib/installment';
import { useRouter } from 'next/navigation';
import type { Category } from '@/types/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

import CategorySelectDialog from '@/components/forms/transaction/CategorySelectDialog';
import AddCategoryDialog from '@/components/forms/transaction/AddCategoryDialog';

// Sub-components
import TransactionAmountInput from './transaction/TransactionAmountInput';
import TransactionCategorySelect from './transaction/TransactionCategorySelect';
import TransactionMemoInput from './transaction/TransactionMemoInput';
import TransactionInstallmentOption from './transaction/TransactionInstallmentOption';
import TransactionRecurringOption from './transaction/TransactionRecurringOption';

export interface TransactionFormData {
  type: 'income' | 'expense';
  date: Date;
  amount: number;
  category_id: string;
  memo: string;
  is_recurring: boolean;
  end_type: 'never' | 'date';
  end_date?: Date;
  // 할부 관련 필드
  is_installment?: boolean;
  installment_months?: number;
  installment_rate?: number;
  installment_free_months?: number;
}

interface TransactionFormProps {
  categories: Category[];
  onSubmit: (data: TransactionFormData) => Promise<void>;
  initialDate?: Date;
  initialData?: TransactionFormData;
  isEditMode?: boolean;
  isRecurringFixed?: boolean;
}

export default function TransactionForm({ categories, onSubmit, initialDate, initialData, isEditMode = false, isRecurringFixed = false }: TransactionFormProps) {
  const router = useRouter();
  const [type, setType] = useState<'expense' | 'income'>(initialData?.type || 'expense');
  const [date, setDate] = useState<Date>(initialData?.date || initialDate || new Date());
  const [amount, setAmount] = useState(initialData?.amount ? initialData.amount.toLocaleString() : '');
  const [categoryId, setCategoryId] = useState<string | null>(initialData?.category_id || null);
  const [memo, setMemo] = useState(initialData?.memo || '');
  const [isRecurring, setIsRecurring] = useState(initialData?.is_recurring || false);
  const [isLoading, setIsLoading] = useState(false);

  // 금액에서 콤마 제거 후 숫자로 변환
  const getRawAmount = () => {
    return amount ? parseInt(amount.replace(/,/g, ''), 10) : 0;
  };

  // 고정 지출 옵션
  const [endType, setEndType] = useState<'never' | 'date'>(initialData?.end_type || 'never');
  const [endDate, setEndDate] = useState<Date | undefined>(initialData?.end_date ? new Date(initialData.end_date) : undefined);

  // 할부 관련 state
  const [paymentType, setPaymentType] = useState<'lumpsum' | 'installment'>(
    initialData?.is_installment ? 'installment' : 'lumpsum'
  );
  const [installmentMonths, setInstallmentMonths] = useState(initialData?.installment_months || 3);
  const [annualRate, setAnnualRate] = useState(initialData?.installment_rate || 0);
  const [interestFreeMonths, setInterestFreeMonths] = useState(initialData?.installment_free_months || 0);

  // 할부 선택 시 미리보기 계산
  const installmentPreview = paymentType === 'installment' && getRawAmount() > 0
    ? calculateInstallment({
        principal: getRawAmount(),
        months: installmentMonths,
        annualRate,
        interestFreeMonths,
      })
    : null;

  // initialDate 변경 시 state 업데이트 (useEffect 필요)
  useEffect(() => {
    if (initialDate) {
      setDate(initialDate);
    }
  }, [initialDate]);

  // 카테고리 추가 로직
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCategorySelectOpen, setIsCategorySelectOpen] = useState(false);

  const addCategoryMutation = useMutation({
    mutationFn: async (newCategory: { name: string; icon: string; type: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 기존 카테고리 중 가장 큰 sort_order 조회
      const { data: maxOrderData } = await supabase
        .from('categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle(); 
      
      const currentMax = maxOrderData ? (maxOrderData as { sort_order: number }).sort_order : 0;
      const nextOrder = (currentMax ?? 0) + 1;

      // @ts-expect-error - Supabase insert 타입 에러 회피
      const { error } = await supabase.from('categories').insert({
        user_id: user.id,
        name: newCategory.name,
        icon: newCategory.icon,
        type: newCategory.type,
        sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsAddDialogOpen(false);
    },
  });

  const handleAddCategory = (name: string, icon: string) => {
    addCategoryMutation.mutate({
      name,
      icon,
      type, // 현재 선택된 탭(지출/수입)의 카테고리로 추가
    });
  };

  const filteredCategories = categories.filter((c) => c.type === type);
  const selectedCategory = categories.find((c) => c.category_id === categoryId);

  // 금액 포맷팅 (콤마 추가)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value) {
      setAmount(Number(value).toLocaleString());
    } else {
      setAmount('');
    }
  };

  const handleSubmit = async () => {
    if (!amount || !categoryId) return;

    setIsLoading(true);
    try {
      await onSubmit({
        type,
        date,
        amount: getRawAmount(),
        category_id: categoryId,

        memo,
        is_recurring: isRecurring,
        end_type: endType,
        end_date: endDate,
        // 할부 관련 필드
        is_installment: paymentType === 'installment',
        installment_months: paymentType === 'installment' ? installmentMonths : undefined,
        installment_rate: paymentType === 'installment' ? annualRate : undefined,
        installment_free_months: paymentType === 'installment' ? interestFreeMonths : undefined,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // 타입을 변경할 때 카테고리 선택 초기화
  const handleTypeChange = (newType: 'income' | 'expense') => {
    if (type !== newType) {
      setType(newType);
      setCategoryId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-sm px-4 py-3 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 rounded-full h-10 w-10 hover:bg-black/5 dark:hover:bg-white/10">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <span className="text-lg font-bold">{isEditMode ? '내역 수정' : '새로운 내역'}</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-5 py-2 space-y-8">


        {/* 날짜 선택 */}
        <div className="flex justify-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-auto py-2 px-4 rounded-full bg-muted/30 hover:bg-muted/50 text-foreground font-medium text-base",
                  !date && "text-muted-foreground"
                )}
              >
                {date ? format(date, "M월 d일 (EEE)", { locale: ko }) : <span>날짜 선택</span>}
                <CalendarIcon className="ml-2 h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-none" align="center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className="rounded-2xl"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 금액 입력 (수입/지출 토글) */}
        <TransactionAmountInput
          type={type}
          amount={amount}
          onChange={handleAmountChange}
          onTypeChange={handleTypeChange}
        />

        {/* 카테고리 선택 */}
        <TransactionCategorySelect
          selectedCategory={selectedCategory}
          onClick={() => setIsCategorySelectOpen(true)}
        />

        {/* 메모 */}
        <TransactionMemoInput
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        {/* 결제 방식 섹션 (지출일 때만 표시) */}
        {type === 'expense' && (
          <TransactionInstallmentOption
            paymentType={paymentType}
            onPaymentTypeChange={setPaymentType}
            installmentMonths={installmentMonths}
            onInstallmentMonthsChange={setInstallmentMonths}
            annualRate={annualRate}
            onAnnualRateChange={setAnnualRate}
            interestFreeMonths={interestFreeMonths}
            onInterestFreeMonthsChange={setInterestFreeMonths}
            installmentPreview={installmentPreview}
          />
        )}

        {/* 고정 지출 설정 (할부가 아닐 때만 표시) */}
        {paymentType !== 'installment' && (
          <TransactionRecurringOption
            isRecurring={isRecurring}
            onRecurringChange={setIsRecurring}
            isRecurringFixed={isRecurringFixed}
            endType={endType}
            onEndTypeChange={setEndType}
            endDate={endDate}
            onEndDateChange={setEndDate}
          />
        )}
      </div>

      <div className="p-4 bg-background/80 backdrop-blur-md sticky bottom-0 z-20">
        <Button 
          className={cn(
              "w-full h-14 rounded-2xl text-lg font-bold shadow-lg transition-all active:scale-[0.98]",
              type === 'income' ? "shadow-income/20 hover:bg-income/90 bg-income" : "shadow-expense/20 hover:bg-expense/90 bg-expense"
          )}
          size="lg"
          onClick={handleSubmit}
          disabled={!amount || !categoryId || isLoading}
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

      {/* 카테고리 선택 다이얼로그 */}
      <CategorySelectDialog
          open={isCategorySelectOpen}
          onOpenChange={setIsCategorySelectOpen}
          categories={filteredCategories}
          selectedCategoryId={categoryId}
          onSelect={setCategoryId}
          onAddNew={() => {
              setIsCategorySelectOpen(false);
              setIsAddDialogOpen(true);
          }}
      />

      {/* 카테고리 추가 다이얼로그 */}
      <AddCategoryDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          type={type}
          onAdd={handleAddCategory}
          isPending={addCategoryMutation.isPending}
      />
    </div>
  );
}
