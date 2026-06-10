import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { buildReconcilePlan, type FixedItemLite } from '@/lib/recurring-reconcile';
import type { Database } from '@/types/database';

type FixedTransaction = Database['public']['Tables']['fixed_transactions']['Row'];

/**
 * 급여일(사이클) 변경 시 현재 사이클 고정지출 재정렬.
 * - 자동생성 거래(source_fixed_id)만 정리/재생성, 수동입력·과거 기록은 보존
 * - 할부 항목 제외, 본인 데이터만(세션 인증 + RLS)
 * - 멱등: 같은 입력으로 여러 번 호출해도 결과 동일
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const oldCycleDay = Number(body?.oldCycleDay);
    const newCycleDay = Number(body?.newCycleDay);
    if (!Number.isInteger(oldCycleDay) || !Number.isInteger(newCycleDay) ||
        oldCycleDay < 1 || oldCycleDay > 31 || newCycleDay < 1 || newCycleDay > 31) {
      return NextResponse.json({ error: 'Invalid cycle day' }, { status: 400 });
    }

    // 활성 고정지출 조회 (본인 것만)
    const { data: fixedRows, error: fetchError } = await supabase
      .from('fixed_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);
    if (fetchError) throw fetchError;

    const fixedItems = (fixedRows as FixedTransaction[]) || [];
    const itemMap = new Map<string, FixedTransaction>(
      fixedItems.map(f => [f.fixed_transaction_id, f])
    );

    // KST 기준 오늘
    const now = new Date();
    const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    const plan = buildReconcilePlan({
      fixedItems: fixedItems as FixedItemLite[],
      oldCycleDay,
      newCycleDay,
      today: kstDate,
    });

    if (!plan.cycleChanged) {
      return NextResponse.json({ success: true, cycleChanged: false, reconciled: 0 });
    }

    const reconciledIds: string[] = [];
    for (const action of plan.actions) {
      const item = itemMap.get(action.fixedId);
      if (!item) continue;

      // 1) 현재 기간(구∪신 사이클)의 자동생성 거래 정리 — 수동입력(source_fixed_id NULL)은 건드리지 않음
      const { error: delError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('source_fixed_id', action.fixedId)
        .gte('date', plan.clearWindow.start)
        .lte('date', plan.clearWindow.end);
      if (delError) {
        console.error(`reconcile delete failed for ${action.fixedId}:`, delError);
        continue;
      }

      // 2) 새 사이클 날짜로 1건 재생성
      const { error: insError } = await supabase
        .from('transactions')
        // @ts-expect-error - Supabase insert 타입 불일치 (기존 코드 관례)
        .insert({
          user_id: user.id,
          amount: item.amount,
          type: item.type,
          category_id: item.category_id,
          date: action.targetDate,
          memo: item.memo,
          source_fixed_id: action.fixedId,
        });
      if (insError) {
        console.error(`reconcile insert failed for ${action.fixedId}:`, insError);
        continue;
      }

      // 3) last_generated 갱신 (cron 중복방지가 새 사이클을 인식하도록)
      await supabase
        .from('fixed_transactions')
        // @ts-expect-error - update 타입 불일치 (기존 코드 관례)
        .update({ last_generated: action.targetDate })
        .eq('fixed_transaction_id', action.fixedId)
        .eq('user_id', user.id);

      reconciledIds.push(action.fixedId);
    }

    return NextResponse.json({
      success: true,
      cycleChanged: true,
      reconciled: reconciledIds.length,
      skipped: plan.skipped.length,
      clearWindow: plan.clearWindow,
    });
  } catch (error) {
    console.error('Reconcile failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
