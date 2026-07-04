'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import TransactionForm, { TransactionFormData } from '@/components/forms/TransactionForm';
import { showToast } from '@/lib/toast';
import { format } from 'date-fns';
import { generateBackfillDates } from '@/lib/backfill';
import type { Category, Database } from '@/types/database';

type FixedTransaction = Database['public']['Tables']['fixed_transactions']['Row'];

export default function NewRecurringPage() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 카테고리 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('created_at');
      if (error) throw error;
      return data as Category[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const day = formData.date.getDate(); // 선택한 날짜의 '일'을 사용

            const { data: newFixedData, error } = await supabase
        .from('fixed_transactions')
        // @ts-expect-error - Supabase insert 타입 불일치
        .insert({
          user_id: user.id,
          type: formData.type,
          day: day,
          amount: formData.amount,
          category_id: formData.category_id,
          memo: formData.memo,
          end_type: formData.end_type,
          // toISOString은 KST 자정을 UTC 전날로 만들어 하루 밀림 → format으로 통일
          end_date: formData.end_date ? format(formData.end_date, 'yyyy-MM-dd') : null,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newFixed = newFixedData as FixedTransaction;

      // 선택한 시작 날짜부터 현재(오늘이 속한 달)까지 트랜잭션 생성
      // 예: 2025-09-24 선택, 현재 2026-01-25 -> 9, 10, 11, 12, 1월분 생성
      try {
        const startDate = new Date(formData.date);
        const now = new Date();

        // 종료일 문자열 (yyyy-MM-dd)
        const endDateStr =
          formData.end_type === 'date' && formData.end_date
            ? format(formData.end_date, 'yyyy-MM-dd')
            : null;

        // 백필 대상 날짜 계산은 공용 유틸로 통일 (lib/backfill)
        const targetDates = generateBackfillDates({ startDate, now, day, endDateStr });

        const generatedDates: string[] = [];

        for (const targetDateStr of targetDates) {
          const { error: txError } = await supabase
              .from('transactions')
              // @ts-expect-error - Supabase insert 타입 불일치
              .insert({
                  user_id: user.id,
                  amount: formData.amount,
                  type: formData.type,
                  category_id: formData.category_id,
                  date: targetDateStr,
                  memo: formData.memo,
                  source_fixed_id: newFixed.fixed_transaction_id,
              });

          if (!txError || txError.code === '23505') {
             // 23505: 이미 생성된 회차 → 중복 방지 정상 동작
             generatedDates.push(targetDateStr);
          } else {
             console.error(`Failed to generate transaction for ${targetDateStr}`, txError);
          }
        }

        // 가장 최근에 생성된 날짜로 last_generated 업데이트
        if (generatedDates.length > 0) {
            const lastGeneratedDate = generatedDates[generatedDates.length - 1];
            await supabase
                .from('fixed_transactions')
                // @ts-expect-error - update 타입 불일치
                .update({ last_generated: lastGeneratedDate })
                .eq('fixed_transaction_id', newFixed.fixed_transaction_id);
        }

      } catch (genError) {
          console.error('Failed to generate initial transactions:', genError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
      // 백필로 transactions에 직접 insert하므로 홈 캘린더/합계 반영 위해 함께 무효화 (3-7)
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      showToast.success('고정 내역이 추가되었습니다');
      router.back();
    },
    onError: (error) => {
      console.error(error);
      showToast.error('추가에 실패했습니다');
    }
  });

  return (
    <TransactionForm 
      categories={categories}
      onSubmit={async (data) => {
        await addMutation.mutateAsync(data);
      }}
      initialData={{
        type: 'expense',
        date: new Date(),
        amount: 0,
        category_id: '',
        memo: '',
        is_recurring: true, // 고정됨
        end_type: 'never',
      }}
      isRecurringFixed={true} // 반복 설정 고정 (항상 켜짐, disabled)
      isEditMode={false}
    />
  );
}
