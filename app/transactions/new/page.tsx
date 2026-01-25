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

        // 과거 내역 일괄 생성 로직 (Recurring Page와 동일하게 적용)
        try {
            const startDate = new Date(data.date);
            const now = new Date();
            const day = startDate.getDate();
            
            let pointer = new Date(startDate);
            const generatedDates: string[] = [];
    
            // 루프: pointer가 이번 달(포함) 이전인 동안 반복
            while (
              pointer.getFullYear() < now.getFullYear() || 
              (pointer.getFullYear() === now.getFullYear() && pointer.getMonth() <= now.getMonth())
            ) {
              const year = pointer.getFullYear();
              const month = pointer.getMonth(); // 0-based
              
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const targetDay = Math.min(day, daysInMonth);
              
              const targetDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
              const targetDateObj = new Date(targetDateStr);
    
              // 종료일 체크
              if (data.end_type === 'date' && data.end_date) {
                 const endDateObj = new Date(data.end_date);
                 if (targetDateObj > endDateObj) break;
              }
    
              // 트랜잭션 생성
              const { error: txError } = await supabase
                  .from('transactions')
                  // @ts-expect-error - Supabase insert 타입 불일치
                  .insert({
                      user_id: user.id,
                      amount: data.amount,
                      type: data.type,
                      category_id: data.category_id,
                      date: targetDateStr,
                      memo: data.memo,
                      source_fixed_id: sourceFixedId,
                  } as TransactionInsert);
    
              if (!txError) {
                 generatedDates.push(targetDateStr);
              } else {
                 console.error(`Failed to generate transaction for ${targetDateStr}`, txError);
              }
    
              pointer = new Date(year, month + 1, 1);
            }
    
            // 가장 최근에 생성된 날짜로 last_generated 업데이트
            if (generatedDates.length > 0) {
                const lastGeneratedDate = generatedDates[generatedDates.length - 1];
                await supabase
                    .from('fixed_transactions')
                    // @ts-expect-error - update 타입 불일치
                    .update({ last_generated: lastGeneratedDate })
                    .eq('fixed_transaction_id', sourceFixedId);
            }

        } catch (genError) {
             console.error('Failed to generate initial transactions for recurring:', genError);
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
