'use client';

import TransactionForm from '@/components/forms/TransactionForm';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/lib/toast';
import type { Category } from '@/types/database';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addMonths, format, parseISO, isValid } from 'date-fns';
import { createFixedWithBackfill } from '@/lib/recurring/client';
import { locationColumns, type TransactionLocation } from '@/lib/location/types';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';


interface TransactionFormData {
  amount: number;
  type: 'income' | 'expense';
  category_id: string;
  date: Date;
  memo?: string;
  is_recurring?: boolean;
  end_type?: 'never' | 'date';
  end_date?: Date;
  // 할부 관련 필드
  is_installment?: boolean;
  installment_months?: number;
  installment_rate?: number;
  installment_free_months?: number;
  location?: TransactionLocation | null;
}

function NewTransactionContent() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // URL에서 date 파라미터 확인 (잘못된 값은 무시 → format() RangeError 방지)
  const dateParam = searchParams.get('date');
  // new Date('yyyy-MM-dd')는 UTC 자정으로 파싱돼 서쪽 시간대에서 하루 밀림 → parseISO(로컬 자정)
  const parsedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? parseISO(dateParam) : null;
  const initialDate = parsedDate && isValid(parsedDate) ? parsedDate : undefined;

  // 카테고리 로드
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('created_at');
      if (error) throw error;
      return data as Category[];
    },
  });

  // 거래 저장 Mutation
  const mutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const formattedDate = format(data.date, 'yyyy-MM-dd');

      // 1. 할부 결제: 고정 항목 등록 후 회차 생성은 서버 엔진이 시작일 기준으로 처리
      if (data.is_installment && data.installment_months) {
        const { calculateInstallment } = await import('@/lib/installment');
        const installmentResult = calculateInstallment({
          principal: data.amount,
          months: data.installment_months,
          annualRate: data.installment_rate || 0,
          interestFreeMonths: data.installment_free_months || 0,
        });

        await createFixedWithBackfill(supabase, {
          user_id: user.id,
          type: 'expense', // 할부는 항상 지출
          day: data.date.getDate(),
          start_date: formattedDate,
          amount: installmentResult.monthlyPayment,
          category_id: data.category_id,
          memo: data.memo || null,
          end_type: 'date',
          end_date: format(addMonths(data.date, data.installment_months), 'yyyy-MM-dd'),
          is_installment: true,
          installment_principal: data.amount,
          installment_months: data.installment_months,
          installment_rate: data.installment_rate || 0,
          installment_free_months: data.installment_free_months || 0,
        });
        return;
      }

      // 2. 고정 내역: 시작일부터 현재 사이클까지 소급 생성 (미래 시작이면 시작일 도래 시 생성)
      if (data.is_recurring) {
        await createFixedWithBackfill(supabase, {
          user_id: user.id,
          amount: data.amount,
          type: data.type,
          category_id: data.category_id,
          memo: data.memo || null,
          day: data.date.getDate(),
          start_date: formattedDate,
          end_type: data.end_type || 'never',
          end_date: data.end_type === 'date' && data.end_date ? format(data.end_date, 'yyyy-MM-dd') : null,
        });
        return;
      }

      // 3. 일반 거래 내역 등록 (반복 아님)
      const { error: transactionError } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: data.amount,
        type: data.type,
        category_id: data.category_id,
        date: formattedDate,
        memo: data.memo || null,
        ...locationColumns(data.location),
        input_source: 'manual',
      } as never);

      if (transactionError) throw transactionError;
    },
    onSuccess: () => {
      // 쿼리 무효화 및 이동
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      // 반복/할부는 fixed_transactions에도 insert하므로 목록 갱신 위해 함께 무효화 (3-7)
      queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
      showToast.transactionSaved();
      router.back(); 
      router.refresh(); 
    },
    onError: (error) => {
      console.error('Error saving transaction:', error);
      showToast.error('저장 중 오류가 발생했습니다.');
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-8">
      <TransactionForm 
        categories={categories} 
        onSubmit={async (data) => await mutation.mutateAsync(data)}
        initialDate={initialDate}
      />
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <NewTransactionContent />
    </Suspense>
  );
}
