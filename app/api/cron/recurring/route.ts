import { createAdminClient } from '@/lib/supabase/admin';
import { type Database } from '@/types/database';

type FixedTransactionUpdate = Database['public']['Tables']['fixed_transactions']['Update'];
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
    
    // 타입 추론 우회
    const items = recurringItems as any[];
    
    for (const item of items) {
      // 2. 조건 검사
      
      // 2-1. 날짜 확인
      if (item.day !== currentDay) continue;

      // 2-2. 이번 달 이미 생성 확인
      if (item.last_generated && item.last_generated.startsWith(currentMonthStr)) {
        continue;
      }

      // 2-3. 종료일 확인
      if (item.end_type === 'date' && item.end_date) {
        if (new Date(item.end_date) < kstDate) continue;
      }

      // 3. 거래 생성
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: item.user_id,
          amount: item.amount,
          type: item.type,
          category_id: item.category_id,
          date: currentDateStr,
          memo: item.memo, // 고정 지출 메모를 그대로 사용 (또는 "[고정] " 접두어 추가 가능)
          source_fixed_id: item.fixed_transaction_id,
        } as any);

      if (insertError) {
        console.error(`Failed to insert transaction for fixed_id ${item.fixed_transaction_id}:`, insertError);
        continue;
      }

      // 4. last_generated 업데이트
      const { error: updateError } = await supabase
        .from('fixed_transactions')
        // @ts-ignore
        .update({ last_generated: currentDateStr })
        .eq('fixed_transaction_id', item.fixed_transaction_id);
        
      processedItems.push(item.fixed_transaction_id);
    }

    return NextResponse.json({
      success: true,
      processed_count: processedItems.length,
      processed_ids: processedItems,
      date: currentDateStr
    });

  } catch (error: any) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
