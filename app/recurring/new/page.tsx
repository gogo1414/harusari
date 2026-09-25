'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import TransactionForm, { TransactionFormData } from '@/components/forms/TransactionForm';
import { showToast } from '@/lib/toast';
import { format } from 'date-fns';
import { createFixedWithBackfill } from '@/lib/recurring/client';
import type { Category } from '@/types/database';

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

      // 선택한 시작일부터 현재 급여 사이클까지의 회차는 서버 엔진이 생성 (lib/recurring/engine.ts)
      await createFixedWithBackfill(supabase, {
        user_id: user.id,
        type: formData.type,
        day: formData.date.getDate(),
        start_date: format(formData.date, 'yyyy-MM-dd'),
        amount: formData.amount,
        category_id: formData.category_id,
        memo: formData.memo || null,
        end_type: formData.end_type,
        // toISOString은 KST 자정을 UTC 전날로 만들어 하루 밀림 → format으로 통일
        end_date:
          formData.end_type === 'date' && formData.end_date ? format(formData.end_date, 'yyyy-MM-dd') : null,
      });
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
