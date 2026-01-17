'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import InstallmentForm, { InstallmentFormData } from '@/components/forms/InstallmentForm';
import { showToast } from '@/lib/toast';
import type { Category } from '@/types/database';
import { addMonths } from 'date-fns';
import { calculateInstallment } from '@/lib/installment';

export default function NewInstallmentPage() {
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
    mutationFn: async (formData: InstallmentFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const day = formData.date.getDate(); // 선택한 날짜의 '일'을 사용
      
      // 종료일 계산: 시작일로부터 할부 개월 수만큼 뒤의 날짜
      const endDate = addMonths(formData.date, formData.months);

      // 첫 달 납입금 계산 (amount > 0 CHECK 제약 조건 만족을 위해)
      const installmentResult = calculateInstallment({
        principal: formData.principal,
        months: formData.months,
        annualRate: formData.annualRate,
        interestFreeMonths: formData.interestFreeMonths
      });
      const firstMonthPayment = installmentResult.monthlyPayment;

      const { error } = await supabase
        .from('fixed_transactions')
        // @ts-expect-error - Supabase insert 타입 불일치 (할부 필드 추가됨)
        .insert({
          user_id: user.id,
          type: 'expense', // 할부는 무조건 지출
          day: day,
          amount: firstMonthPayment, // 첫 달 납입금 저장 (목록에서 표시용 및 CHECK 제약조건 만족)
          
          category_id: formData.category_id,
          memo: `${formData.memo} (할부 1/${formData.months})`, // 초기 메모
          
          // 고정 지출 설정
          end_type: 'date',
          end_date: endDate.toISOString().split('T')[0],
          is_active: true,

          // 할부 전용 필드
          is_installment: true,
          installment_principal: formData.principal,
          installment_months: formData.months,
          installment_rate: formData.annualRate,
          installment_free_months: formData.interestFreeMonths,
          installment_current_month: 1 // 1회차부터 시작
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_transactions'] });
      showToast.success('할부 내역이 등록되었습니다');
      router.push('/recurring'); // 고정 지출 목록으로 이동
    },
    onError: (error) => {
      console.error(error);
      showToast.error('등록에 실패했습니다');
    }
  });

  return (
    <InstallmentForm
      categories={categories}
      onSubmit={async (data) => {
        await addMutation.mutateAsync(data);
      }}
      onCancel={() => router.back()}
      isSubmitting={addMutation.isPending}
    />
  );
}
