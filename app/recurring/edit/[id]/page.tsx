'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import TransactionForm, { TransactionFormData } from '@/components/forms/TransactionForm';
import { showToast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';
import type { Category, FixedTransaction } from '@/types/database';

export default function EditRecurringPage() {
  const router = useRouter();
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

  const { data: fixedItem, isLoading } = useQuery({
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

            const { error } = await supabase
        .from('fixed_transactions')
        // @ts-expect-error - Supabase update 타입 불일치
        .update({
          type: formData.type,
          day: day,
          amount: formData.amount,
          category_id: formData.category_id,
          memo: formData.memo,
          end_type: formData.end_type,
          end_date: formData.end_date ? format(formData.end_date, 'yyyy-MM-dd') : null,
        })
        .eq('fixed_transaction_id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['fixed_transaction', id] });
      showToast.success('고정 내역이 수정되었습니다');
      router.back();
    },
    onError: (error) => {
      console.error(error);
      showToast.error('수정에 실패했습니다');
    }
  });

  if (isLoading || !fixedItem) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 현재 날짜 기준으로 day 설정 (날짜 선택 UI에 표시하기 위함)
  const today = new Date();
  const initialDate = new Date(today.getFullYear(), today.getMonth(), fixedItem.day);

  const initialData: TransactionFormData = {
    type: fixedItem.type,
    date: initialDate,
    amount: fixedItem.amount,
    category_id: fixedItem.category_id || '',
    memo: fixedItem.memo || '',
    is_recurring: true,
    end_type: fixedItem.end_type || 'never',
    end_date: fixedItem.end_date ? new Date(fixedItem.end_date) : undefined,
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
