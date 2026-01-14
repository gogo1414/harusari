'use client';

import TransactionForm from '@/app/components/TransactionForm';
import { createClient } from '@/lib/supabase/client';
import type { Category } from '@/types/database';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function NewTransactionPage() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 카테고리 로드
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      return data as Category[];
    },
  });

  // 거래 저장 Mutation
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const formattedDate = format(data.date, 'yyyy-MM-dd');

      // 1. 고정 내역 등록 (선택 시)
      let sourceFixedId = null;

      if (data.is_recurring) {
        const { data: fixedData, error: fixedError } = await supabase
          .from('fixed_transactions')
          .insert({
            user_id: user.id,
            amount: data.amount,
            type: data.type,
            category_id: data.category_id,
            memo: data.memo,
            day: data.date.getDate(), // 매월 해당 일자
            end_type: data.end_type || 'never',
            end_date: data.end_date ? format(data.end_date, 'yyyy-MM-dd') : null,
            is_active: true,
            last_generated: formattedDate, // 오늘 생성된 걸로 처리
          })
          .select()
          .single();

        if (fixedError) throw fixedError;
        sourceFixedId = fixedData.fixed_transaction_id;
      }

      // 2. 실제 거래 내역 등록
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: data.amount,
        type: data.type,
        category_id: data.category_id,
        date: formattedDate,
        memo: data.memo,
        source_fixed_id: sourceFixedId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      // 쿼리 무효화 및 이동
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      router.back(); 
      router.refresh(); // 데이터 갱신 보장
    },
    onError: (error) => {
      console.error('Error saving transaction:', error);
      alert('저장 중 오류가 발생했습니다.');
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
      />
    </div>
  );
}
