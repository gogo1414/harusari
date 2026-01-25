'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronLeft, Repeat as RepeatIcon, Loader2, CreditCard, Calculator, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { calculateInstallment } from '@/lib/installment';
import { formatCurrency } from '@/lib/format';
import { useRouter } from 'next/navigation';
import type { Category } from '@/types/database';
import { CategoryIcon } from '@/components/category/IconPicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

import OptionCard, { OptionCardWithSwitch } from '@/components/common/OptionCard';
import ToggleButton from '@/components/common/ToggleButton';

import CategorySelectDialog from '@/components/forms/transaction/CategorySelectDialog';
import AddCategoryDialog from '@/components/forms/transaction/AddCategoryDialog';


export interface TransactionFormData {
  type: 'income' | 'expense';
  date: Date;
  amount: number;
  category_id: string;
  // asset_id?: string; // Removed
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
  // const [assetId, setAssetId] = useState<string | null>(initialData?.asset_id || null); // Removed
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
        .maybeSingle(); // single() 대신 maybeSingle() 사용 (결과가 없을 수도 있음)
      
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
        <div className="flex flex-col items-center">
           <div className="flex bg-muted/40 p-1.5 rounded-full mb-6 relative">
             <button
                onClick={() => {
                  if (type !== 'expense') {
                    setType('expense');
                    setCategoryId(null);
                  }
                }}
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
                onClick={() => {
                  if (type !== 'income') {
                    setType('income');
                    setCategoryId(null);
                  }
                }}
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
              onChange={handleAmountChange}
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



        {/* 카테고리 선택 */}
        <div>
          <label className="text-[13px] font-bold text-muted-foreground ml-1 mb-2 block">카테고리</label>
          <button
            type="button"
            onClick={() => setIsCategorySelectOpen(true)}
            className={cn(
              "w-full flex items-center gap-4 rounded-2xl border p-4 transition-all",
              selectedCategory
                ? "bg-card border-primary/30 shadow-sm"
                : "bg-muted/30 border-border hover:bg-muted/50"
            )}
          >
            {selectedCategory ? (
              <>
                <CategoryIcon
                  iconName={selectedCategory.icon}
                  className="h-12 w-12"
                  variant="circle"
                  showBackground={true}
                />
                <span className="font-bold text-lg">{selectedCategory.name}</span>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground font-medium">카테고리 선택</span>
              </>
            )}
            <ChevronLeft className="ml-auto h-5 w-5 text-muted-foreground rotate-180" />
          </button>
        </div>

        {/* 메모 */}
        <div>
          <label className="text-[13px] font-bold text-muted-foreground ml-1 mb-2 block">메모</label>
          <Input 
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="어떤 내역인가요?"
            className="h-14 rounded-2xl bg-muted/30 border-none text-lg px-5 focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background transition-all"
          />
        </div>

        {/* 결제 방식 섹션 (지출일 때만 표시) */}
        {type === 'expense' && (
          <OptionCard
            icon={CreditCard}
            title="결제 방식"
            description="일시불 또는 할부를 선택하세요"
            active={paymentType === 'installment'}
          >
            <ToggleButton.Group
              value={paymentType}
              onChange={(val) => setPaymentType(val as 'lumpsum' | 'installment')}
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
                    onValueChange={(val) => setInstallmentMonths(parseInt(val))}
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
                        onChange={(e) => setAnnualRate(parseFloat(e.target.value) || 0)}
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
                      onValueChange={(val) => setInterestFreeMonths(parseInt(val))}
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
        )}

        {/* 고정 지출 설정 (할부가 아닐 때만 표시) */}
        {paymentType !== 'installment' && (
          <OptionCardWithSwitch
            icon={RepeatIcon}
            title="반복 설정"
            description="매월 자동으로 기록할까요?"
            active={isRecurring}
            checked={isRecurring}
            onCheckedChange={isRecurringFixed ? () => {} : setIsRecurring} // Type fix: onCheckedChange expects function
            disabled={isRecurringFixed}
          >
            {isRecurring && (
              <div className="pt-2 pl-1 space-y-4 animate-in slide-in-from-top-2 fade-in duration-300">
                <div className="bg-background rounded-2xl p-4 shadow-sm">
                  <Label className="text-xs text-muted-foreground mb-3 block font-bold">종료일</Label>
                  <ToggleButton.Group
                    value={endType}
                    onChange={(val) => setEndType(val as 'never' | 'date')}
                    className="mb-3"
                  >
                    <ToggleButton value="never" className="flex-1 py-3 text-sm">계속 반복</ToggleButton>
                    <ToggleButton value="date" className="flex-1 py-3 text-sm">날짜 지정</ToggleButton>
                  </ToggleButton.Group>

                  {endType === 'date' && (
                    <div className="mt-3 animate-in fade-in pt-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-center font-medium h-12 rounded-xl bg-muted/30 border-none hover:bg-muted/50",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                            {endDate ? format(endDate, "yyyy년 M월 d일", { locale: ko }) : <span>종료일 선택</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-none" align="center">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            disabled={(d) => d < new Date()}
                            initialFocus
                            className="rounded-2xl"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </div>
            )}
          </OptionCardWithSwitch>
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
