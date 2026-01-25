import { createAdminClient } from '@/lib/supabase/admin';
import { type Database } from '@/types/database';

type FixedTransaction = Database['public']['Tables']['fixed_transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
import { NextResponse } from 'next/server';

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
  
  const currentDay = kstDate.getUTCDate(); // 오늘 일자 (1~31)
  const currentMonthStr = kstDate.toISOString().slice(0, 7); // "YYYY-MM"
  const currentDateStr = kstDate.toISOString().slice(0, 10); // "YYYY-MM-DD"

  try {
    // 1. 활성 고정 지출 조회
    const { data: recurringItems, error } = await supabase
      .from('fixed_transactions')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    const processedItems = [];
    
    const items = recurringItems as FixedTransaction[];
    
    for (const item of items) {
      // 2. 중복 방지 체크 (이번 달에 이미 생성되었는지 확인)
      // last_generated가 "2024-02" 등으로 시작하면 이미 생성된 것
      if (item.last_generated && item.last_generated.startsWith(currentMonthStr)) {
        continue;
      }

      // 3. 종료일 확인
      // 이번 달의 말일까지 유효한지 체크해야 하지만, 
      // 간단히 "현재 시점" 기준으로 종료일이 지났는지만 확인해도 충분
      if (item.end_type === 'date' && item.end_date) {
        // 만약 종료일이 이번 달 1일보다 이전이라면 생성하지 않음
        const endDateObj = new Date(item.end_date);
        const thisMonthFirst = new Date(kstDate.getFullYear(), kstDate.getMonth(), 1);
        if (endDateObj < thisMonthFirst) continue;
      }

      // 4. 날짜 계산 (YYYY-MM-DD)
      // 만약 2월인데 30일로 설정되어 있다면 -> 2월 29일(말일)로 조정
      const year = kstDate.getFullYear();
      const month = kstDate.getMonth(); // 0-based
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const targetDay = Math.min(item.day, daysInMonth); 
      // 예: item.day가 31이고 2월(29일)이면 -> targetDay는 29
      
      const targetDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

      // 5. 거래 생성
      const insertPayload: TransactionInsert = {
        user_id: item.user_id,
        amount: item.amount,
        type: item.type,
        category_id: item.category_id,
        date: targetDateStr, // 미래 날짜라도 그대로 등록
        memo: item.memo,
        source_fixed_id: item.fixed_transaction_id,
      };

      const { error: insertError } = await supabase
        .from('transactions')
        // @ts-expect-error - Supabase insert 타입 불일치
        .insert(insertPayload);

      if (insertError) {
        // 에러 로그는 유지 (운영 중 필요)
        console.error(`Failed to insert transaction for fixed_id ${item.fixed_transaction_id}:`, insertError);
        continue;
      }

      // 6. last_generated 업데이트 (YYYY-MM-DD 형식으로 저장되지만, 체크 시에는 startsWith(YYYY-MM) 사용)
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
