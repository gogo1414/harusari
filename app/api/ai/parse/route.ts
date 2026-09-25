import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getKstTodayStr } from '@/lib/kst';
import { diffDays, isValidYmd } from '@/lib/ai/dates';
import { parseTransactionText } from '@/lib/ai/parse';
import type { CategoryOption } from '@/lib/ai/types';
import type { Category } from '@/types/database';

/**
 * AI 빠른 입력: 자유 텍스트 → 거래 초안 (저장하지 않음, 사용자 확인용).
 * POST { text: string; today?: string; defaultDate?: string } → ParseResult
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TEXT_LENGTH = 500;
const RATE_LIMIT = 20; // 사용자당 분당 요청 수
const RATE_WINDOW_MS = 60_000;
const RATE_MAP_MAX_USERS = 5000;

/** 인스턴스 메모리 기반 간이 레이트 리밋 (서버리스 인스턴스별로 따로 동작하는 best-effort) */
const requestLog = new Map<string, number[]>();

function isRateLimited(userId: string, now: number): boolean {
  const recent = (requestLog.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    requestLog.set(userId, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(userId, recent);

  // 메모리 폭주 방지: 오래된 사용자 기록 정리
  if (requestLog.size > RATE_MAP_MAX_USERS) {
    for (const [key, times] of requestLog) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) requestLog.delete(key);
    }
  }
  return false;
}

/** 클라이언트가 보낸 기준일은 서버 KST 오늘 ±1일 이내일 때만 인정 (자정 전후 시차 보정용) */
function resolveToday(clientToday: unknown): string {
  const serverToday = getKstTodayStr();
  if (isValidYmd(clientToday) && Math.abs(diffDays(clientToday, serverToday)) <= 1) {
    return clientToday;
  }
  return serverToday;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      text?: unknown;
      today?: unknown;
      defaultDate?: unknown;
    } | null;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ error: '내용을 입력해 주세요' }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `${MAX_TEXT_LENGTH}자 이내로 입력해 주세요` },
        { status: 400 }
      );
    }

    if (isRateLimited(user.id, Date.now())) {
      return NextResponse.json(
        { error: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const today = resolveToday(body?.today);
    // 캘린더에서 고른 날짜: 오늘 기준 400일 전 ~ 31일 후만 인정 (normalize 허용 범위와 동일)
    const defaultDate =
      isValidYmd(body?.defaultDate) &&
      diffDays(body.defaultDate as string, today) >= -400 &&
      diffDays(body.defaultDate as string, today) <= 31
        ? (body.defaultDate as string)
        : undefined;

    // RLS로 본인 카테고리만 조회된다
    const { data: rows, error: catError } = await supabase
      .from('categories')
      .select('category_id, name, type')
      .order('sort_order');
    if (catError) {
      console.error('[ai/parse] categories fetch failed:', catError.message);
    }
    // Database 타입 정의상 select 결과가 never로 추론되어 명시적으로 캐스팅한다 (기존 코드와 동일한 방식)
    const categoryRows = (rows ?? []) as unknown as Pick<
      Category,
      'category_id' | 'name' | 'type'
    >[];
    const categories: CategoryOption[] = categoryRows.map((r) => ({
      id: r.category_id,
      name: r.name,
      type: r.type,
    }));

    const result = await parseTransactionText(text, categories, today, { defaultDate });
    if (catError) {
      result.warnings.push('카테고리를 불러오지 못해 분류 없이 분석했어요');
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    // 입력 원문은 로그에 남기지 않는다
    console.error('[ai/parse] error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: '분석 중 문제가 생겼어요' }, { status: 500 });
  }
}
