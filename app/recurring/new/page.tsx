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

        if (targetDates.length > 0) {
          // 개별 insert(N+1) → 배열 단일 insert로 원자화 (3-11).
          // 신규 fixed_transaction_id라 (source_fixed_id, date) 충돌은 정상 경로에서 발생하지 않는다.
          const rows = targetDates.map((targetDateStr) => ({
            user_id: user.id,
            amount: formData.amount,
            type: formData.type,
            category_id: formData.category_id,
            date: targetDateStr,
            memo: formData.memo,
            source_fixed_id: newFixed.fixed_transaction_id,
          }));

          // @ts-expect-error - Supabase insert 타입 불일치
          const { error: txError } = await supabase.from('transactions').insert(rows);

          // 23505(재시도 등으로 이미 존재)는 멱등 처리, 그 외 에러는 부분 데이터 없이 전체 실패로 알림
          if (txError && txError.code !== '23505') {
            throw txError;
          }

          const lastGeneratedDate = targetDates[targetDates.length - 1];
          await supabase
              .from('fixed_transactions')
              // @ts-expect-error - update 타입 불일치
              .update({ last_generated: lastGeneratedDate })
              .eq('fixed_transaction_id', newFixed.fixed_transaction_id);
        }

      } catch (genError) {
          // 고정 내역 자체는 등록됨. 과거분 백필만 실패한 것이므로 경고만 노출(다음 cron이 보정).
          console.error('Failed to generate initial transactions:', genError);
          showToast.warning('고정 내역은 등록됐지만 과거 내역 생성에 실패했어요. 다음 자동 생성 때 반영됩니다.');
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
