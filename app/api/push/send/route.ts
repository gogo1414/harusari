import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import webPush, { WebPushError } from 'web-push';
import { getKstTodayStr } from '@/lib/kst';
import { clampedDateStr } from '@/lib/recurring/engine';

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
    
    // 보안 체크: fail-closed. CRON_SECRET 미설정 시 발송 라우트가 무인증 개방되던 문제 수정.
    if (!process.env.CRON_SECRET) {
      console.error('CRON_SECRET is not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    // 서버 TZ(UTC)와 무관하게 KST 달력 날짜 기준으로 계산
    const todayStr = getKstTodayStr();
    const [todayY, todayM] = todayStr.split('-').map(Number);

    // 1. 모든 구독 정보 가져오기 (PostgREST 기본 1000행 제한 → 페이지 단위로)
    const subscriptions: { user_id: string; subscription: unknown }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error: subError } = await supabase
        .from('user_push_subscriptions')
        .select('user_id, subscription')
        .order('id')
        .range(from, from + 999);
      if (subError) throw subError;
      const page = (data || []) as { user_id: string; subscription: unknown }[];
      subscriptions.push(...page);
      if (page.length < 1000) break;
    }
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
          // 아침: 오늘 날짜로 생성된 고정지출/할부 거래 확인
          // (고정 항목의 day로 찾으면 29~31일 말일 클램프·종료일·미래 시작을 반영하지 못함.
          //  자동 생성 엔진이 만든 오늘자 거래가 곧 "오늘 나갈 돈"이다)
          const { data, error: fixedError } = await supabase
            .from('transactions')
            .select('amount, memo')
            .eq('user_id', user_id)
            .eq('date', todayStr)
            .eq('type', 'expense')
            .not('source_fixed_id', 'is', null);
          if (fixedError) throw fixedError;

          const fixedList = data as unknown as { amount: number; memo: string | null }[] | null;

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
          // 저녁: 일일 브리핑 (수입/지출 요약)
          // 오늘(KST)의 수입/지출 내역 합산
          const { data, error: todayError } = await supabase
            .from('transactions')
            .select('amount, type')
            .eq('user_id', user_id)
            .eq('date', todayStr);
          if (todayError) throw todayError;

          const transactions = data as unknown as { amount: number; type: string }[] | null;
          
          let totalIncome = 0;
          let totalExpense = 0;

          if (transactions) {
            transactions.forEach(t => {
              if (t.type === 'income') totalIncome += t.amount;
              else if (t.type === 'expense') totalExpense += t.amount;
            });
          }

          // 3. 메시지 생성
          if (totalIncome > 0 && totalExpense > 0) {
            payload = {
              title: '🌙 오늘 하루 수입/지출 요약',
              body: `오늘 ${totalExpense.toLocaleString()}원 쓰고, ${totalIncome.toLocaleString()}원 벌었습니다.`,
              url: '/',
              icon: '/icons/icon-192.png'
            };
          } else if (totalExpense > 0) {
            payload = {
              title: '🌙 오늘 하루 소비 요약',
              body: `오늘 총 ${totalExpense.toLocaleString()}원을 소비했습니다.`,
              url: '/',
              icon: '/icons/icon-192.png'
            };
          } else if (totalIncome > 0) {
            payload = {
              title: '🌙 오늘 하루 수입 요약',
              body: `오늘 ${totalIncome.toLocaleString()}원 수입이 있었습니다.`,
              url: '/',
              icon: '/icons/icon-192.png'
            };
          } else {
            payload = {
              title: '🌙 오늘 하루는 어떠셨나요?',
              body: '오늘 기록된 내역이 없습니다.',
              url: '/',
              icon: '/icons/icon-192.png'
            };
          }
        }
        else if (type === 'monthly') {
          // 월간: 지난달 지출 분석 알림 (매월 1일 발송)
          // 지난달 1일 ~ 말일 (문자열 계산: toISOString의 UTC 변환으로 하루 밀리던 문제 방지)
          const startStr = clampedDateStr(todayY, todayM - 2, 1);
          const endStr = clampedDateStr(todayY, todayM - 2, 31);
          const monthLabel = `${Number(startStr.slice(5, 7))}월`;

          // 지난달 총 지출액 조회 (지출만, 수입 제외)
          const { data, error: monthError } = await supabase
            .from('transactions')
            .select('amount, type')
            .eq('user_id', user_id)
            .gte('date', startStr)
            .lte('date', endStr)
            .eq('type', 'expense');
          if (monthError) throw monthError;

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
        
        // 구독 만료(410)·없음(404) 시 DB에서 삭제
        if (err instanceof WebPushError && (err.statusCode === 410 || err.statusCode === 404)) {
           await supabase
             .from('user_push_subscriptions')
             .delete()
             .eq('user_id', user_id)
             .filter('subscription->>endpoint', 'eq', (subscription as unknown as { endpoint: string }).endpoint);
           results.push({ user_id, status: 'removed' });
        } else {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            results.push({ user_id, status: 'error', error: errorMessage });
        }
      }
    }

    // 응답에 user_id(UUID)를 노출하지 않도록 집계만 반환
    const summary = results.reduce(
      (acc, r) => {
        acc[r.status] += 1;
        return acc;
      },
      { sent: 0, removed: 0, error: 0 } as Record<PushSendResult['status'], number>
    );

    return NextResponse.json({ success: true, type, ...summary });
  } catch (error: unknown) {
    console.error('Push Cron Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

