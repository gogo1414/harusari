'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import TransactionForm, { TransactionFormData } from '@/components/forms/TransactionForm';
import { showToast } from '@/lib/toast';
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
          end_date: formData.end_date ? formData.end_date.toISOString().split('T')[0] : null,
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
        const kstOffset = 9 * 60 * 60 * 1000;
        
        // "언제까지 생성할 것인가?" -> 현재 시점의 '월'까지 (미래 날짜라도 이번 달이면 생성)
        // 비교를 위해 날짜 객체 복사
        let pointer = new Date(startDate);
        
        const generatedDates: string[] = [];

        // 루프: pointer가 이번 달(포함) 이전인 동안 반복
        // (년도가 적거나, 년도가 같으면서 월이 작거나 같은 경우)
        while (
          pointer.getFullYear() < now.getFullYear() || 
          (pointer.getFullYear() === now.getFullYear() && pointer.getMonth() <= now.getMonth())
        ) {
          const year = pointer.getFullYear();
          const month = pointer.getMonth(); // 0-based
          
          // 이번 달의 말일 계산 (2월 30일 설정 시 2월 28/29일로 조정 로직)
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const targetDay = Math.min(day, daysInMonth);
          
          const targetDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
          const targetDateObj = new Date(targetDateStr);

          // 종료일 체크
          if (formData.end_type === 'date' && formData.end_date) {
             const endDateObj = new Date(formData.end_date);
             // 종료일이 해당 회차 날짜보다 빠르면 생성 중단
             if (targetDateObj > endDateObj) break;
          }

          // 트랜잭션 생성
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

          if (!txError) {
             generatedDates.push(targetDateStr);
          } else {
             console.error(`Failed to generate transaction for ${targetDateStr}`, txError);
          }

          // 다음 달로 이동
          // 주의: 단순 setMonth+1 은 말일 문제(1/31 -> 2/28 -> 3/28) 발생 가능성.
          // 사용자가 지정한 "원래 day"를 유지하며 달만 바꿔야 함.
          // pointer를 다음달 1일로 설정하고, 루프 내부에서 원래 'day'를 적용하는 식인 이미 그렇게 하고 있음.
          // 여기서 pointer만 다음 달로 넘겨주면 됨.
          pointer = new Date(year, month + 1, 1);
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
