'use client';

import { useParams } from 'next/navigation';
import { useBackOrHome } from '@/hooks/useBackOrHome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { getKstTodayStr } from '@/lib/kst';
import { requestRecurringSync } from '@/lib/recurring/client';
import { createClient } from '@/lib/supabase/client';
import TransactionForm, { TransactionFormData } from '@/components/forms/TransactionForm';
import { showToast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';
import QueryErrorState from '@/components/common/QueryErrorState';
import type { Category, FixedTransaction } from '@/types/database';

export default function EditRecurringPage() {
  // 딥링크로 바로 들어온 경우 router.back()은 앱 밖(about:blank)으로 나가므로 fallback 경로 사용
  const goBack = useBackOrHome('/recurring');
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('created_at');
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: fixedItem, isLoading, isError, refetch } = useQuery({
    queryKey: ['fixed_transaction', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_transactions')
        .select('*')
        .eq('fixed_transaction_id', id)
        .single();
      
      if (error) throw error;
      return data as FixedTransaction;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const day = formData.date.getDate();
      const endDate =
        formData.end_type === 'date' && formData.end_date ? format(formData.end_date, 'yyyy-MM-dd') : null;
      // 종료일을 미래로 늘리거나 없애면 다시 활성화 (엔진이 종료된 항목을 비활성화하므로)
      const isActive = !endDate || endDate >= getKstTodayStr();

      const { error } = await supabase
        .from('fixed_transactions')
        .update({
          type: formData.type,
          day: day,
          amount: formData.amount,
          category_id: formData.category_id,
          memo: formData.memo || null,
          end_type: formData.end_type,
          end_date: endDate,
          is_active: isActive,
        } as never)
        .eq('fixed_transaction_id', id);

      if (error) throw error;

      // 결제일 변경 등으로 이번 사이클에 새로 생길 회차가 있으면 즉시 반영 (실패해도 수정은 유지)
      try {
        await requestRecurringSync();
      } catch (syncError) {
        console.error('recurring sync after edit failed:', syncError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['fixed_transaction', id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      showToast.success('고정 내역이 수정되었습니다');
      goBack();
    },
    onError: (error) => {
      console.error(error);
      showToast.error('수정에 실패했습니다');
    }
  });

  if (isError) {
    return <QueryErrorState fullHeight onRetry={() => refetch()} />;
  }

  if (isLoading || !fixedItem) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 현재 날짜 기준으로 day 설정 (날짜 선택 UI에 표시하기 위함)
  // day=31 등 해당 월에 없는 일자는 다음 달로 롤오버되므로 말일로 클램프
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const initialDate = new Date(today.getFullYear(), today.getMonth(), Math.min(fixedItem.day, lastDayOfMonth));

  const initialData: TransactionFormData = {
    type: fixedItem.type,
    date: initialDate,
    amount: fixedItem.amount,
    category_id: fixedItem.category_id || '',
    memo: fixedItem.memo || '',
    is_recurring: true,
    end_type: fixedItem.end_type || 'never',
    end_date: fixedItem.end_date ? parseISO(fixedItem.end_date) : undefined,
  };

  return (
    <TransactionForm 
      categories={categories}
      onSubmit={async (data) => {
        await updateMutation.mutateAsync(data);
      }}
      initialData={initialData}
      isEditMode={true}
      isRecurringFixed={true}
    />
  );
}
