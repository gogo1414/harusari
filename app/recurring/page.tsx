'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FixedTransaction, Category } from '@/types/database';

import RecurringSummary from './components/RecurringSummary';
import RecurringList from './components/RecurringList';
import RecurringDeleteDialog from './components/RecurringDeleteDialog';

// 카테고리 join된 고정 거래 타입
interface FixedTransactionWithCategory extends FixedTransaction {
  categories: Category | null;
}

export default function RecurringPage() {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteRelated, setDeleteRelated] = useState(false);
  const isDeletingRef = useRef(false);

  // 고정 지출 조회
  const { data: recurringItems = [], isLoading } = useQuery({
    queryKey: ['fixed_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_transactions')
        .select(`
          *,
          categories:category_id (*)
        `)
        .order('day', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // 삭제 Mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, deleteRelated }: { id: string; deleteRelated: boolean }) => {
      // 1. 관련 거래 삭제 (옵션)
      if (deleteRelated) {
        const { error: relatedError } = await supabase
          .from('transactions')
          .delete()
          .eq('source_fixed_id', id);
        if (relatedError) throw relatedError;
      }

      // 2. 고정 지출 삭제
      const { error } = await supabase
        .from('fixed_transactions')
        .delete()
        .eq('fixed_transaction_id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
      // 관련 거래도 삭제했다면 거래 목록도 갱신
      if (deleteRelated) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }
      setDeleteId(null);
      setDeleteRelated(false);
    },
  });

  const handleDeleteConfirm = () => {
    if (deleteId && !isDeletingRef.current) {
      isDeletingRef.current = true;
      deleteMutation.mutate({ id: deleteId, deleteRelated }, {
         onSettled: () => {
             isDeletingRef.current = false;
         }
      });
    }
  };



  // 통계 계산
  const stats = recurringItems.reduce(
    (acc: { income: number; expense: number }, item: FixedTransactionWithCategory) => {
      if (item.type === 'income') acc.income += item.amount;
      else acc.expense += item.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return (
    <div className="min-h-dvh bg-background pb-20">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 backdrop-blur-sm px-4 py-3 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 rounded-full h-10 w-10">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold">고정 지출/수입 관리</h1>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/recurring/new')} 
          className="ml-auto rounded-full h-10 w-10 hover:bg-black/5 dark:hover:bg-white/10"
        >
           <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* 요약 카드 */}
        <RecurringSummary stats={stats} />

        {/* 목록 */}
        <RecurringList
          isLoading={isLoading}
          items={recurringItems}
          onEdit={(id, isInstallment) => {
            if (isInstallment) {
              router.push(`/installment/edit/${id}`);
            } else {
              router.push(`/recurring/edit/${id}`);
            }
          }}
          onDelete={(id) => setDeleteId(id)}
        />
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <RecurringDeleteDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        deleteRelated={deleteRelated}
        onDeleteRelatedChange={setDeleteRelated}
      />
    </div>
  );
}
