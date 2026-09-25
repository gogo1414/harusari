import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { syncRecurring } from '@/lib/recurring/runner';
import { getKstTodayStr } from '@/lib/kst';

/**
 * 고정 지출/수입·할부 자동 생성 cron (GitHub Actions가 하루 2회 호출).
 * 생성 규칙은 lib/recurring/engine.ts 참고. 멱등이라 여러 번 호출해도 결과가 같다.
 */
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

  try {
    const supabase = createAdminClient();
    const result = await syncRecurring(supabase, { mode: 'current' });

    if (result.failures.length > 0) {
      console.error('[cron/recurring] partial failures:', JSON.stringify(result.failures));
    }

    return NextResponse.json(
      {
        success: result.failures.length === 0,
        date: getKstTodayStr(),
        processed: result.processed,
        created: result.created,
        deactivated: result.deactivated,
        failed: result.failures.length,
      },
      // 일부 실패는 207로 알려 GitHub Actions 로그에서 식별 가능하게 (curl -f는 통과)
      { status: result.failures.length > 0 ? 207 : 200 }
    );
  } catch (error) {
    console.error('Cron job failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
