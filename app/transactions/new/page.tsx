'use client';

import TransactionForm from '@/components/forms/TransactionForm';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/lib/toast';
import type { Category, Database } from '@/types/database';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { buildInstallmentBackfillEntries } from '@/lib/installment-logic';
import { generateBackfillDates } from '@/lib/backfill';
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

  // URL에서 date 파라미터 확인 (잘못된 값은 무시 → format() RangeError 방지)
  const dateParam = searchParams.get('date');
  const parsedDate = dateParam ? new Date(dateParam) : null;
  const initialDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : undefined;

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
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      // 시작일이 미래면 백필이 0건이므로, last_generated를 시작일로 두면 cron이 1회차를 영구 스킵한다.
      const isFutureStart = formattedDate > todayStr;
      let sourceFixedId: string | null = null;

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
          // 미래 시작이면 null → cron이 시작일 도래 시 1회차를 생성 (1회차 누락 방지)
          last_generated: isFutureStart ? null : formattedDate,
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

        // 시작월~현재월 과거분 백필 생성
        const backfillEntries = buildInstallmentBackfillEntries({
          startDate: data.date,
          now: new Date(),
          months: data.installment_months,
          schedule: installmentResult.schedule,
          memo: data.memo,
        });

        if (backfillEntries.length > 0) {
          // 개별 insert(N+1) → 배열 단일 insert로 원자화 (3-11). 신규 sourceFixedId라 충돌 없음.
          const rows = backfillEntries.map((entry) => ({
            user_id: user.id,
            amount: entry.amount,
            type: 'expense',
            category_id: data.category_id,
            date: entry.date,
            memo: entry.memo,
            source_fixed_id: sourceFixedId,
          }));

          // @ts-expect-error - Supabase insert 타입 불일치
          const { error: transactionError } = await supabase.from('transactions').insert(rows as TransactionInsert[]);

          // 23505(재시도로 이미 존재)는 멱등 처리, 그 외는 전체 실패로 알림
          if (transactionError && transactionError.code !== '23505') throw transactionError;

          const lastEntry = backfillEntries[backfillEntries.length - 1];
          await supabase
            .from('fixed_transactions')
            // @ts-expect-error - Supabase update 타입 불일치 (할부 필드)
            .update({
              last_generated: lastEntry.date,
              installment_current_month: lastEntry.round,
              amount: lastEntry.amount,
              memo: lastEntry.memo,
            })
            .eq('fixed_transaction_id', sourceFixedId);
        }

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
          // 미래 시작이면 null (아래 백필 루프에서 이번 달 회차 생성 시 갱신됨)
          last_generated: isFutureStart ? null : formattedDate,
        };

        const { data: fixedData, error: fixedError } = await supabase
          .from('fixed_transactions')
          // @ts-expect-error - Supabase insert 타입 불일치
          .insert(fixedPayload as FixedTransactionInsert)
          .select()
          .single();

        if (fixedError) throw fixedError;
        sourceFixedId = (fixedData as FixedTransactionRow).fixed_transaction_id;

        // 과거 내역 일괄 생성 로직 (공용 유틸로 통일 — lib/backfill)
        try {
            const startDate = new Date(data.date);
            const now = new Date();
            const day = startDate.getDate();

            const endDateStr =
              data.end_type === 'date' && data.end_date
                ? format(data.end_date, 'yyyy-MM-dd')
                : null;

            const targetDates = generateBackfillDates({ startDate, now, day, endDateStr });

            if (targetDates.length > 0) {
              // 개별 insert(N+1) → 배열 단일 insert로 원자화 (3-11). 신규 sourceFixedId라 충돌 없음.
              const rows = targetDates.map((targetDateStr) => ({
                user_id: user.id,
                amount: data.amount,
                type: data.type,
                category_id: data.category_id,
                date: targetDateStr,
                memo: data.memo,
                source_fixed_id: sourceFixedId,
              }));

              // @ts-expect-error - Supabase insert 타입 불일치
              const { error: txError } = await supabase.from('transactions').insert(rows as TransactionInsert[]);

              if (txError && txError.code !== '23505') throw txError;

              const lastGeneratedDate = targetDates[targetDates.length - 1];
              await supabase
                  .from('fixed_transactions')
                  // @ts-expect-error - update 타입 불일치
                  .update({ last_generated: lastGeneratedDate })
                  .eq('fixed_transaction_id', sourceFixedId);
            }

        } catch (genError) {
             // 고정 내역 자체는 등록됨. 과거분 백필만 실패한 것이므로 경고만 노출(다음 cron이 보정).
             console.error('Failed to generate initial transactions for recurring:', genError);
             showToast.warning('고정 내역은 등록됐지만 과거 내역 생성에 실패했어요. 다음 자동 생성 때 반영됩니다.');
        }
        
        return; // Recurring 처리가 끝났으므로 함수 종료 (중복 insert 방지)
      }

      // 3. 일반 거래 내역 등록 (반복 아님)
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
