'use client';

import TransactionForm from '@/components/forms/TransactionForm';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/lib/toast';
import type { Category, Database } from '@/types/database';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
type FixedTransactionInsert = Database['public']['Tables']['fixed_transactions']['Insert'];
type FixedTransactionRow = Database['public']['Tables']['fixed_transactions']['Row'];

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
}

function NewTransactionContent() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // URL에서 date 파라미터 확인
  const dateParam = searchParams.get('date');
  const initialDate = dateParam ? new Date(dateParam) : undefined;

  // 카테고리 로드
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*');
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
      let sourceFixedId = null;

      // 1. 할부 결제 처리
      if (data.is_installment && data.installment_months) {
        // 할부는 fixed_transactions에 저장하고 첫 달 거래만 transactions에 저장
        const { calculateInstallment } = await import('@/lib/installment');
        const { addMonths } = await import('date-fns');

        const installmentResult = calculateInstallment({
          principal: data.amount,
          months: data.installment_months,
          annualRate: data.installment_rate || 0,
          interestFreeMonths: data.installment_free_months || 0,
        });

        const endDate = addMonths(data.date, data.installment_months);

        const fixedPayload = {
          user_id: user.id,
          type: 'expense', // 할부는 항상 지출
          day: data.date.getDate(),
          amount: installmentResult.monthlyPayment, // 첫 달 납입금
          category_id: data.category_id,
          memo: `${data.memo || ''} (할부 1/${data.installment_months})`.trim(),
          end_type: 'date',
          end_date: format(endDate, 'yyyy-MM-dd'),
          is_active: true,
          last_generated: formattedDate,
          // 할부 전용 필드
          is_installment: true,
          installment_principal: data.amount,
          installment_months: data.installment_months,
          installment_rate: data.installment_rate || 0,
          installment_free_months: data.installment_free_months || 0,
          installment_current_month: 1,
        };

        const { data: fixedData, error: fixedError } = await supabase
          .from('fixed_transactions')
          // @ts-expect-error - Supabase insert 타입 불일치 (할부 필드)
          .insert(fixedPayload as FixedTransactionInsert)
          .select()
          .single();

        if (fixedError) throw fixedError;
        sourceFixedId = (fixedData as FixedTransactionRow).fixed_transaction_id;

        // 첫 달 거래 내역 저장 (할부 첫 회차)
        // @ts-expect-error - Supabase insert 타입 불일치
        const { error: transactionError } = await supabase.from('transactions').insert({
          user_id: user.id,
          amount: installmentResult.monthlyPayment, // 첫 달 납입금
          type: 'expense',
          category_id: data.category_id,
          date: formattedDate,
          memo: `${data.memo || ''} (할부 1/${data.installment_months})`.trim(),
          source_fixed_id: sourceFixedId,
        } as TransactionInsert);

        if (transactionError) throw transactionError;
        return; // 할부 처리 완료
      }

      // 2. 고정 내역 등록 (선택 시)
      if (data.is_recurring) {
        const fixedPayload = {
          user_id: user.id,
          amount: data.amount,
          type: data.type,
          category_id: data.category_id,
          memo: data.memo,
          day: data.date.getDate(),
          end_type: data.end_type || 'never',
          end_date: data.end_date ? format(data.end_date, 'yyyy-MM-dd') : null,
          is_active: true,
          last_generated: formattedDate,
        };

        const { data: fixedData, error: fixedError } = await supabase
          .from('fixed_transactions')
          // @ts-expect-error - Supabase insert 타입 불일치
          .insert(fixedPayload as FixedTransactionInsert)
          .select()
          .single();

        if (fixedError) throw fixedError;
        sourceFixedId = (fixedData as FixedTransactionRow).fixed_transaction_id;
      }

      // 3. 일반 거래 내역 등록
      // @ts-expect-error - Supabase insert 타입 불일치
      const { error: transactionError } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: data.amount,
        type: data.type,
        category_id: data.category_id,
        date: formattedDate,
        memo: data.memo,
        source_fixed_id: sourceFixedId,
      } as TransactionInsert);

      if (transactionError) throw transactionError;
    },
    onSuccess: () => {
      // 쿼리 무효화 및 이동
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
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
