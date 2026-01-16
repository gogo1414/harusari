'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import TransactionForm, { TransactionFormData } from '@/components/forms/TransactionForm';
import { showToast } from '@/lib/toast';
import type { Category } from '@/types/database';

export default function NewRecurringPage() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 카테고리 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      return data as Category[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const day = formData.date.getDate(); // 선택한 날짜의 '일'을 사용

            const { error } = await supabase
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
        });

      if (error) throw error;
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
