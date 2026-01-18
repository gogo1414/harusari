import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import webPush, { WebPushError } from 'web-push';
import { getDate } from 'date-fns';

// Push Notification Payload Interface
interface PushPayload {
  title: string;
  body: string;
  url: string;
  icon: string;
}

// Push Send Result Interface
interface PushSendResult {
  user_id: string;
  status: 'sent' | 'removed' | 'error';
  type?: string | null;
  error?: string;
}

// VAPID 설정
let vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@harusari.app';
if (!vapidSubject.startsWith('mailto:') && !vapidSubject.startsWith('http')) {
  vapidSubject = `mailto:${vapidSubject}`;
}
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

// VAPID keys should be configured inside the handler or lazily to avoid build-time errors
// when environment variables might not be fully available or when static analysis runs.

export async function GET(request: Request) {
  try {
    if (!publicKey || !privateKey) {
      console.error('VAPID public/private keys are missing in environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    webPush.setVapidDetails(vapidSubject, publicKey, privateKey);

    const { searchParams } = new URL(request.url);
    let type = searchParams.get('type'); // 'morning' | 'evening' | 'test'
    
    // Cron으로 실행되어 파라미터가 없는 경우 시간으로 타입 추론 (UTC 기준)
    if (!type) {
        const now = new Date();
        const utcHour = now.getUTCHours();
        const utcDate = now.getUTCDate();

        if (utcHour === 0) type = 'morning';      // 09:00 KST
        else if (utcHour === 12) type = 'evening'; // 21:00 KST
        else if (utcHour === 1 && utcDate === 1) type = 'monthly'; // 1일 10:00 KST
    }

    // 유효하지 않은 타입이거나 Monthly가 아닌데 01시 호출인 경우 등은 종료
    if (!type) {
        return NextResponse.json({ message: 'No valid push type determined from time' });
    }
    
    // 보안 체크 (Vercel Cron 사용 시 CRON_SECRET 필요)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const currentDay = getDate(now); // 1~31

    // 1. 모든 구독 정보 가져오기
    const { data: subscriptions, error: subError } = await supabase
      .from('user_push_subscriptions')
      .select('user_id, subscription');

    if (subError) throw subError;
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions found' });
    }

    const results: PushSendResult[] = [];

    // 2. 각 사용자별로 조건 체크 및 발송
    for (const sub of subscriptions) {
      const { user_id, subscription } = sub;
      let payload: PushPayload | null = null;

      try {
        if (type === 'test') {
          payload = {
            title: '🔔 알림 테스트',
            body: '하루살이 알림이 잘 도착했나요?',
            url: '/',
            icon: '/icons/icon-192.png'
          };
        } 
        else if (type === 'morning') {
          // 아침: 오늘 예정된 고정지출/할부 확인
          const { data } = await supabase
            .from('fixed_transactions')
            .select('amount, memo, is_installment')
            .eq('user_id', user_id)
            .eq('day', currentDay)
            .eq('is_active', true);
            
          const fixedList = data as unknown as { amount: number; memo: string | null; is_installment: boolean }[] | null;

          if (fixedList && fixedList.length > 0) {
            const totalAmount = fixedList.reduce((sum, item) => sum + item.amount, 0);
            const count = fixedList.length;
            const msg = count === 1 
              ? `${fixedList[0].memo || '고정지출'} 결제 예정일입니다.`
              : `${fixedList[0].memo || '고정지출'} 외 ${count - 1}건의 결제가 예정되어 있습니다.`;

            payload = {
              title: `💸 오늘 나갈 돈: ${totalAmount.toLocaleString()}원`,
              body: msg,
              url: '/recurring',
              icon: '/icons/icon-192.png'
            };
          }
        } 
        else if (type === 'evening') {
          // 저녁: 일일 브리핑 (지출액 요약)
          // 1. 오늘 날짜 구하기 (KST 기준)
          // Vercel은 UTC 기준이므로, UTC+9 시간을 구해서 날짜 문자열 생성
          const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
          const todayStr = kstTime.toISOString().split('T')[0];
          
          // 2. 오늘의 지출 내역 합산
          const { data } = await supabase
            .from('transactions')
            .select('amount, type')
            .eq('user_id', user_id)
            .eq('date', todayStr)
            .eq('type', 'expense');

          const expenses = data as unknown as { amount: number }[] | null;
          const totalAmount = expenses ? expenses.reduce((sum, item) => sum + item.amount, 0) : 0;
          const hasTransactions = expenses && expenses.length > 0;

          // 3. 메시지 생성 (무조건 발송)
          if (hasTransactions) {
              payload = {
                  title: '🌙 오늘 하루 지출 요약',
                  body: `오늘 총 ${totalAmount.toLocaleString()}원을 지출하셨어요. 꼼꼼한 기록 칭찬해요! 👍`,
                  url: '/',
                  icon: '/icons/icon-192.png'
              };
          } else {
              payload = {
                  title: '🌙 오늘 하루는 어떠셨나요?',
                  body: '오늘 지출 내역이 없네요. 무지출 챌린지 성공?! 잊은 내역이 없는지 확인해보세요.',
                  url: '/',
                  icon: '/icons/icon-192.png'
              };
          }
        }
        else if (type === 'monthly') {
          // 월간: 지난달 지출 분석 알림 (매월 1일 발송)
          const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const startStr = lastMonthDate.toISOString().split('T')[0];
          const endDate = new Date(now.getFullYear(), now.getMonth(), 0); // 지난달 마지막 날
          const endStr = endDate.toISOString().split('T')[0];
          const monthLabel = `${lastMonthDate.getMonth() + 1}월`;

          // 지난달 총 지출액 조회 (지출만, 수입 제외)
          const { data } = await supabase
            .from('transactions')
            .select('amount, type')
            .eq('user_id', user_id)
            .gte('date', startStr)
            .lte('date', endStr)
            .eq('type', 'expense');

          const expenses = data as unknown as { amount: number }[] | null;
          
          if (expenses && expenses.length > 0) {
            const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
            
            payload = {
              title: `📊 ${monthLabel} 가계부 분석 완료`,
              body: `지난달 총 ${totalAmount.toLocaleString()}원을 지출하셨네요. 상세 내역을 확인해보세요!`,
              url: `/stats?month=${startStr.slice(0, 7)}`, // /stats?month=2024-05
              icon: '/icons/icon-192.png'
            };
          } else {
             payload = {
              title: `📊 ${monthLabel} 가계부 분석 완료`,
              body: `지난달 지출 내역이 없습니다. 이번 달은 활기차게 시작해보세요!`,
              url: `/stats?month=${startStr.slice(0, 7)}`,
              icon: '/icons/icon-192.png'
            };
          }
        }

        // 3. 알림 발송
        if (payload) {
          await webPush.sendNotification(
            subscription as webPush.PushSubscription,
            JSON.stringify(payload)
          );
          results.push({ user_id, status: 'sent', type });
        }
      } catch (err: unknown) {
        console.error(`Error sending to user ${user_id}:`, err);
        
        // 구독 만료(410) 시 DB에서 삭제
        if (err instanceof WebPushError && err.statusCode === 410) {
           await supabase
             .from('user_push_subscriptions')
             .delete()
             .eq('user_id', user_id)
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             .filter('subscription->>endpoint', 'eq', (subscription as unknown as { endpoint: string }).endpoint);
           results.push({ user_id, status: 'removed' });
        } else {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            results.push({ user_id, status: 'error', error: errorMessage });
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    console.error('Push Cron Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

