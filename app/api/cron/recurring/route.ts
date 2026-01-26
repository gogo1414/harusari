import { createAdminClient } from '@/lib/supabase/admin';
import { type Database } from '@/types/database';
import { getCycleRange } from '@/lib/date';
import { format } from 'date-fns';
import { NextResponse } from 'next/server';

type FixedTransaction = Database['public']['Tables']['fixed_transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
type UserSettings = Database['public']['Tables']['user_settings']['Row'];

export async function GET(request: Request) {
  // 보안 체크: Vercel Cron 헤더 확인
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

      // 5. 종료일 확인
      if (item.end_type === 'date' && item.end_date) {
        const endDateStr = item.end_date;
        // 종료일이 현재 사이클 시작일보다 이전이면 생성하지 않음
        if (endDateStr < cycleStartStr) continue;
      }

      // 6. 대상 날짜 계산 (현재 사이클 내에서 item.day에 해당하는 날짜)
      const targetDateStr = calculateTargetDateInCycle(item.day, cycleStart, cycleEnd, cycleDay);
      
      if (!targetDateStr) {
        // 현재 사이클에 해당하는 날짜가 없음 (예외 상황)
        continue;
      }

      // 7. 거래 생성
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

      if (insertError) {
        console.error(`Failed to insert transaction for fixed_id ${item.fixed_transaction_id}:`, insertError);
        continue;
      }

      // 8. last_generated 업데이트
      await supabase
        .from('fixed_transactions')
        // @ts-expect-error - last_generated 타입 불일치
        .update({ last_generated: targetDateStr })
        .eq('fixed_transaction_id', item.fixed_transaction_id);
        
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

/**
 * 현재 사이클 내에서 고정지출 날짜(day)에 해당하는 실제 날짜 계산
 * @param day 고정지출 설정 날짜 (1~31)
 * @param cycleStart 사이클 시작일
 * @param cycleEnd 사이클 종료일
 * @param cycleDay 급여일 (사이클 시작일)
 * @returns YYYY-MM-DD 형식의 날짜 문자열
 */
function calculateTargetDateInCycle(
  day: number,
  cycleStart: Date,
  cycleEnd: Date,
  cycleDay: number
): string | null {
  // 사이클이 월을 걸치는 경우를 처리
  // 예: 급여일 25일 -> 사이클 1/25 ~ 2/24
  
  // 사이클 시작월에서 해당 day가 포함되는지 확인
  const startYear = cycleStart.getFullYear();
  const startMonth = cycleStart.getMonth();
  
  // 사이클 종료월
  const endYear = cycleEnd.getFullYear();
  const endMonth = cycleEnd.getMonth();
  
  // Case 1: day가 cycleDay 이상인 경우 -> 사이클 시작월에 해당
  // Case 2: day가 cycleDay 미만인 경우 -> 사이클 종료월에 해당
  
  let targetYear: number;
  let targetMonth: number;
  
  if (day >= cycleDay) {
    // 사이클 시작월에 해당
    targetYear = startYear;
    targetMonth = startMonth;
  } else {
    // 사이클 종료월에 해당
    targetYear = endYear;
    targetMonth = endMonth;
  }
  
  // 해당 월의 일수 확인 (말일 조정)
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, daysInMonth);
  
  const targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  
  // 계산된 날짜가 사이클 범위 내인지 최종 확인
  const cycleStartStr = format(cycleStart, 'yyyy-MM-dd');
  const cycleEndStr = format(cycleEnd, 'yyyy-MM-dd');
  
  if (targetDateStr >= cycleStartStr && targetDateStr <= cycleEndStr) {
    return targetDateStr;
  }
  
  return null;
}
