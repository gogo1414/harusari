'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import InstallmentForm, { InstallmentFormData } from '@/components/forms/InstallmentForm';
import { showToast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';
import type { Category, FixedTransaction } from '@/types/database';
import { addMonths, subMonths, parseISO, setDate, format } from 'date-fns';
import { getInstallmentAmountByCurrentMonth } from '@/lib/installment-logic';
import QueryErrorState from '@/components/common/QueryErrorState';

// 원래 결제일(day)을 해당 월 말일로 클램프
function clampDay(base: Date, day: number): Date {
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return setDate(base, Math.min(day, lastDay));
}

export default function EditInstallmentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
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

  // 기존 할부 데이터 조회
  const { data: installmentData, isLoading, isError, refetch } = useQuery({
    queryKey: ['installment', id],
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

  // 수정 Mutation
  const updateMutation = useMutation({
    mutationFn: async (formData: InstallmentFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const day = formData.date.getDate();
      const endDate = addMonths(formData.date, formData.months);

      const currentMonth = installmentData?.installment_current_month || 1;
      const currentAmount = getInstallmentAmountByCurrentMonth({
        principal: formData.principal,
        months: formData.months,
        annualRate: formData.annualRate,
        interestFreeMonths: formData.interestFreeMonths,
        currentMonth,
      });

      const { error } = await supabase
        .from('fixed_transactions')
        // @ts-expect-error - Supabase update 타입 불일치 (할부 필드)
        .update({
          day: day,
          amount: currentAmount,
          category_id: formData.category_id,
          memo: `${formData.memo} (할부 ${installmentData?.installment_current_month || 1}/${formData.months})`,
          end_date: format(endDate, 'yyyy-MM-dd'),
          installment_principal: formData.principal,
          installment_months: formData.months,
          installment_rate: formData.annualRate,
          installment_free_months: formData.interestFreeMonths,
        })
        .eq('fixed_transaction_id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['installment', id] });
      showToast.success('할부 내역이 수정되었습니다');
      router.back();
    },
    onError: (error) => {
      console.error(error);
      showToast.error('수정에 실패했습니다');
    },
  });

  if (isError) {
    return <QueryErrorState fullHeight onRetry={() => refetch()} />;
  }

  if (isLoading || !installmentData) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 원래 결제 시작일 복원: end_date - months 로 역산하고, 결제일(day)을 말일 클램프해 맞춘다.
  // (초기값을 오늘로 두면 저장만 눌러도 결제일/종료일이 오늘 기준으로 왜곡되던 버그 수정)
  const months = installmentData.installment_months || 3;
  const reconstructedStart = installmentData.end_date
    ? clampDay(subMonths(parseISO(installmentData.end_date), months), installmentData.day)
    : clampDay(new Date(), installmentData.day);

  // 기존 데이터를 폼 초기값으로 변환
  const initialData: InstallmentFormData = {
    date: reconstructedStart,
    principal: installmentData.installment_principal || 0,
    months: installmentData.installment_months || 3,
    annualRate: installmentData.installment_rate || 0,
    interestFreeMonths: installmentData.installment_free_months || 0,
    category_id: installmentData.category_id || '',
    memo: (installmentData.memo || '').replace(/\s*\(할부.*\)$/, ''), // 할부 표시 제거
  };

  return (
    <InstallmentForm
      categories={categories}
      onSubmit={async (data) => {
        await updateMutation.mutateAsync(data);
      }}
      onCancel={() => router.back()}
      isSubmitting={updateMutation.isPending}
      initialData={initialData}
      isEditMode={true}
    />
  );
}
