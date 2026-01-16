'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import InstallmentForm, { InstallmentFormData } from '@/components/forms/InstallmentForm';
import { showToast } from '@/lib/toast';
import type { Category } from '@/types/database';
import { addMonths } from 'date-fns';

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

      const { error } = await supabase
        .from('fixed_transactions')
        // @ts-expect-error - Supabase insert 타입 불일치 (할부 필드 추가됨)
        .insert({
          user_id: user.id,
          type: 'expense', // 할부는 무조건 지출
          day: day,
          amount: 0, // 고정 금액은 0 (매달 계산되므로, 혹은 첫달 금액 넣을 수도 있음. 여기선 0으로 하고 로직에서 처리)
                     // 하지만 '월 납입금'을 대략적으로라도 보여주려면 첫달 금액을 넣는게 좋을 수 있음.
                     // 여기서는 일단 0으로 넣고, 스케줄 생성 시 installment 유틸리티를 쓰도록 함.
                     // 또는, 매달 똑같은 금액이 나가는게 아니므로(이자 때문에),
                     // amount 필드는 '원금균등'일 경우 큰 의미가 없을 수 있음.
                     // 하지만 list 뷰에서 보여줄 때 필요하므로, 첫 달 납입금을 저장하는 것이 좋겠음.
          
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
