'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import TransactionForm, { TransactionFormData } from '@/app/components/TransactionForm';
import { showToast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';
import type { Category, Transaction } from '@/types/database';

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
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

  // 거래 내역 조회
  const { data: transaction, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('transaction_id', id)
        .single();
      
      if (error) throw error;
      return data as Transaction;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
            const { error } = await supabase
        .from('transactions')
        // @ts-expect-error - Supabase update 타입 불일치
        .update({
          type: formData.type,
          date: format(formData.date, 'yyyy-MM-dd'),
          amount: formData.amount,
          category_id: formData.category_id,
          memo: formData.memo,
        })
        .eq('transaction_id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
      showToast.success('내역이 수정되었습니다');
      router.back();
    },
    onError: (error) => {
      console.error(error);
      showToast.error('수정에 실패했습니다');
    }
  });

  if (isLoading || !transaction) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const initialData: TransactionFormData = {
    type: transaction.type,
    date: new Date(transaction.date),
    amount: transaction.amount,
    category_id: transaction.category_id || '',
    memo: transaction.memo || '',
    is_recurring: false, // 일반 수정에서는 false 처리
    end_type: 'never',
  };

  return (
    <TransactionForm 
      categories={categories}
      onSubmit={async (data) => {
        await updateMutation.mutateAsync(data);
      }}
      initialData={initialData}
      isEditMode={true}
    />
  );
}
