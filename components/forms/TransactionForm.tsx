'use client';

import { useState, useEffect, useRef } from 'react';
// import { format } from 'date-fns';
// import { ko } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { calculateInstallment } from '@/lib/installment';
import { validateAmount, validateInstallment } from '@/lib/validation';
import { showToast } from '@/lib/toast';
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
import TransactionDateInput from './transaction/TransactionDateInput';
import TransactionSubmitButton from './transaction/TransactionSubmitButton';

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
  const isSubmittingRef = useRef(false);

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
    if (!categoryId || isSubmittingRef.current) return;

    // 금액 검증: 0원/음수/상한 초과 차단 ("0"은 truthy 문자열이라 !!amount로는 못 막음)
    const rawAmount = getRawAmount();
    const amountError = validateAmount(rawAmount);
    if (amountError) {
      showToast.error(amountError);
      return;
    }
    // 할부 극소액(원금 < 개월수) 방어: 0원 회차로 cron이 매일 실패하는 것을 등록 단계에서 차단
    if (paymentType === 'installment') {
      const installmentError = validateInstallment(rawAmount, installmentMonths);
      if (installmentError) {
        showToast.error(installmentError);
        return;
      }
    }

    isSubmittingRef.current = true;
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
      isSubmittingRef.current = false;
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

        {/* 고정 내역 수정 안내: 이번 사이클에 이미 생성된 거래는 소급 변경되지 않음 */}
        {isEditMode && isRecurringFixed && (
          <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            이미 기록된 이번 사이클 내역은 이 수정으로 바뀌지 않으며, 다음 생성분부터 반영됩니다.
          </div>
        )}

        {/* 날짜 선택 */}
        <TransactionDateInput date={date} onDateChange={setDate} />

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

        {/* 결제 방식 섹션 (지출이면서 신규 등록일 때만 표시)
            수정 화면에서는 update가 반복/할부 필드를 무시하므로 옵션을 숨긴다 (3-6) */}
        {type === 'expense' && !isEditMode && (
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

        {/* 고정 지출 설정 (할부가 아닐 때만 표시)
            일반 거래 수정 화면에서는 숨김. 고정내역 수정(isRecurringFixed)에서는 유지 */}
        {paymentType !== 'installment' && (!isEditMode || isRecurringFixed) && (
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

      <TransactionSubmitButton
        type={type}
        amount={amount}
        isValid={getRawAmount() > 0 && !!categoryId}
        isLoading={isLoading}
        isEditMode={isEditMode}
        onSubmit={handleSubmit}
      />

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
