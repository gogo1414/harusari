'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import InstallmentForm, { InstallmentFormData } from '@/components/forms/InstallmentForm';
import { showToast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';
import type { Category, FixedTransaction } from '@/types/database';
import { addMonths } from 'date-fns';
import { calculateInstallment } from '@/lib/installment';

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
      const { data, error } = await supabase.from('categories').select('*');
      if (error) throw error;
      return data as Category[];
    },
  });

  // 기존 할부 데이터 조회
  const { data: installmentData, isLoading } = useQuery({
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

      // 첫 달 납입금 재계산
      const installmentResult = calculateInstallment({
        principal: formData.principal,
        months: formData.months,
        annualRate: formData.annualRate,
        interestFreeMonths: formData.interestFreeMonths,
      });

      const { error } = await supabase
        .from('fixed_transactions')
        // @ts-expect-error - Supabase update 타입 불일치 (할부 필드)
        .update({
          day: day,
          amount: installmentResult.monthlyPayment,
          category_id: formData.category_id,
          memo: `${formData.memo} (할부 ${installmentData?.installment_current_month || 1}/${formData.months})`,
          end_date: endDate.toISOString().split('T')[0],
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

  if (isLoading || !installmentData) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 기존 데이터를 폼 초기값으로 변환
  const initialData: InstallmentFormData = {
    date: new Date(), // 수정 시에는 현재 날짜 기준으로 표시
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
