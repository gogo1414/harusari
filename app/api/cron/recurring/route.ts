import { createAdminClient } from '@/lib/supabase/admin';
import { type Database } from '@/types/database';
import { getCycleRange, calculateTargetDateInCycle } from '@/lib/date';
import { format } from 'date-fns';
import { NextResponse } from 'next/server';
import { buildCronInstallmentPayload } from '@/lib/installment-logic';

type FixedTransaction = Database['public']['Tables']['fixed_transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
type UserSettings = Database['public']['Tables']['user_settings']['Row'];

export async function GET(request: Request) {
  // 보안 체크: CRON_SECRET 미설정 시 "Bearer undefined" 통과를 막기 위해 fail-closed
  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET is not configured');
    return new NextResponse('Server misconfigured', { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  
  // 한국 시간 기준 현재 날짜 계산
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const currentDateStr = kstDate.toISOString().slice(0, 10); // "YYYY-MM-DD"

  try {
    // 1. 사용자별 급여 사이클 설정 조회
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('user_id, cycle_start_day');
    
    const settingsMap = new Map<string, number>(
      (userSettings as UserSettings[] | null)?.map(s => [s.user_id, s.cycle_start_day || 1]) || []
    );

    // 2. 활성 고정 지출 조회
    const { data: recurringItems, error } = await supabase
      .from('fixed_transactions')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    const processedItems: string[] = [];
    const items = recurringItems as FixedTransaction[];
    
    for (const item of items) {
      // 3. 사용자별 급여 사이클 가져오기 (기본값: 1일)
      const cycleDay = settingsMap.get(item.user_id) || 1;
      const { start: cycleStart, end: cycleEnd } = getCycleRange(kstDate, cycleDay);
      const cycleStartStr = format(cycleStart, 'yyyy-MM-dd');
      const cycleEndStr = format(cycleEnd, 'yyyy-MM-dd');

      // 4. 중복 방지 체크 (이번 사이클에 이미 생성되었는지 확인)
      if (item.last_generated) {
        const lastGenStr = item.last_generated;
        // last_generated가 현재 사이클 범위 내에 있으면 이미 생성된 것
        if (lastGenStr >= cycleStartStr && lastGenStr <= cycleEndStr) {
          continue;
        }
      }

      // 6. 대상 날짜 계산 (현재 사이클 내에서 item.day에 해당하는 날짜)
      const targetDateStr = calculateTargetDateInCycle(item.day, cycleStart, cycleEnd, cycleDay);

      if (!targetDateStr) {
        // 현재 사이클에 해당하는 날짜가 없음 (예외 상황) — 재발 감지를 위해 로깅
        console.warn(
          `[cron/recurring] calculateTargetDateInCycle returned null: fixed_id=${item.fixed_transaction_id}, day=${item.day}, cycle=${cycleStartStr}~${cycleEndStr}`
        );
        continue;
      }

      // 5. 종료일 확인: 종료일이 실제 생성 대상 날짜보다 이전이면 생성하지 않음
      // (사이클 시작일 기준만 보면 종료일 이후에도 생성되던 버그 수정)
      if (item.end_type === 'date' && item.end_date && item.end_date < targetDateStr) {
        continue;
      }

      // 7. 할부 거래 생성
      if (item.is_installment === true) {
        const cronPayload = buildCronInstallmentPayload({
          principal: item.installment_principal || 0,
          months: item.installment_months || 0,
          annualRate: item.installment_rate || 0,
          interestFreeMonths: item.installment_free_months || 0,
          currentMonth: item.installment_current_month || 0,
          memo: item.memo || undefined,
        });

        if (!cronPayload.shouldCreate) {
          if (cronPayload.shouldDeactivate) {
            await supabase
              .from('fixed_transactions')
              // @ts-expect-error - update 타입 불일치
              .update({ is_active: false })
              .eq('fixed_transaction_id', item.fixed_transaction_id);
          }
          continue;
        }

        const { error: installmentInsertError } = await supabase
          .from('transactions')
          // @ts-expect-error - Supabase insert 타입 불일치
          .insert({
            user_id: item.user_id,
            amount: cronPayload.amount,
            type: 'expense',
            category_id: item.category_id,
            date: targetDateStr,
            memo: cronPayload.memo,
            source_fixed_id: item.fixed_transaction_id,
          } as TransactionInsert);

        // 23505(unique_violation)은 이미 생성된 것이므로 실패로 보지 않고 last_generated 갱신으로 진행
        if (installmentInsertError && installmentInsertError.code !== '23505') {
          console.error(`Failed to insert installment transaction for fixed_id ${item.fixed_transaction_id}:`, installmentInsertError);
          continue;
        }

        await supabase
          .from('fixed_transactions')
          // @ts-expect-error - update 타입 불일치
          .update({
            last_generated: targetDateStr,
            installment_current_month: cronPayload.nextCurrentMonth,
            amount: cronPayload.amount,
            memo: cronPayload.memo,
            is_active: cronPayload.shouldDeactivate ? false : item.is_active,
          })
          .eq('fixed_transaction_id', item.fixed_transaction_id);

        processedItems.push(item.fixed_transaction_id);
        continue;
      }

      // 8. 일반 반복 거래 생성
      const insertPayload: TransactionInsert = {
        user_id: item.user_id,
        amount: item.amount,
        type: item.type,
        category_id: item.category_id,
        date: targetDateStr,
        memo: item.memo,
        source_fixed_id: item.fixed_transaction_id,
      };

      const { error: insertError } = await supabase
        .from('transactions')
        // @ts-expect-error - Supabase insert 타입 불일치
        .insert(insertPayload);

      // 23505(unique_violation)은 이미 생성된 것이므로 skip하지 않고 last_generated 갱신으로 진행
      // (update만 실패해 다음 날 재생성되던 3-2 문제도 UNIQUE 제약으로 최종 방어)
      if (insertError && insertError.code !== '23505') {
        console.error(`Failed to insert transaction for fixed_id ${item.fixed_transaction_id}:`, insertError);
        continue;
      }

      // 8. last_generated 업데이트
      const { error: updateError } = await supabase
        .from('fixed_transactions')
        // @ts-expect-error - last_generated 타입 불일치
        .update({ last_generated: targetDateStr })
        .eq('fixed_transaction_id', item.fixed_transaction_id);

      if (updateError) {
        console.error(`Failed to update last_generated for fixed_id ${item.fixed_transaction_id}:`, updateError);
      }

      processedItems.push(item.fixed_transaction_id);
    }

    return NextResponse.json({
      success: true,
      processed_count: processedItems.length,
      processed_ids: processedItems,
      date: currentDateStr
    });

  } catch (error) {
    console.error('Cron job failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
