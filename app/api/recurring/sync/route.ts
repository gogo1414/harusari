import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { syncRecurring } from '@/lib/recurring/runner';

/**
 * 로그인 사용자의 고정 지출/수입·할부를 즉시 동기화한다.
 * - body 없음: 현재 급여 사이클 안에서 빠진 회차 생성 (앱 진입, 급여일 변경 후)
 *   → cron이 지연/누락돼도 앱을 열면 스스로 복구된다.
 * - body { fixedId }: 방금 등록/수정한 항목을 시작일부터 소급 생성 (백필)
 * 사용자 세션 + RLS로 본인 데이터만 다룬다. 멱등.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const fixedId = typeof body?.fixedId === 'string' ? body.fixedId : null;
    if (fixedId && !/^[0-9a-f-]{36}$/i.test(fixedId)) {
      return NextResponse.json({ error: 'Invalid fixedId' }, { status: 400 });
    }

    const result = await syncRecurring(supabase, {
      userId: user.id,
      fixedIds: fixedId ? [fixedId] : undefined,
      mode: fixedId ? 'backfill' : 'current',
    });

    if (result.failures.length > 0) {
      console.error('[recurring/sync] failures:', JSON.stringify(result.failures));
      return NextResponse.json(
        { success: false, created: result.created, failed: result.failures.length },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, created: result.created, deactivated: result.deactivated });
  } catch (error) {
    console.error('Recurring sync failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
