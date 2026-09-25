import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidCoordinate } from '@/lib/location/types';

/** 사용자당 분당 허용 요청 수 */
const RATE_LIMIT_PER_MINUTE = 60;
const WINDOW_MS = 60_000;

/**
 * 사용자별 인메모리 레이트 리밋 (고정 윈도우).
 * 서버리스 인스턴스마다 따로 세지만, 외부 무료 API(Photon) 남용을 막는 용도로는 충분하다.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  userId: string,
  now = Date.now()
): { ok: true } | { ok: false; retryAfter: number } {
  // 메모리 누수 방지: 오래된 버킷 정리
  if (buckets.size > 1000) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }
  const bucket = buckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count >= RATE_LIMIT_PER_MINUTE) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true };
}

export function jsonError(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store', ...headers } }
  );
}

export function jsonOk(body: unknown) {
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, max-age=300' } });
}

export const UPSTREAM_ERROR_MESSAGE = '장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';

/** 인증 + 레이트 리밋. 실패 시 응답을, 성공 시 null을 돌려준다 */
export async function guardRequest(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('로그인이 필요해요', 401);

  const limit = checkRateLimit(user.id);
  if (!limit.ok) {
    return jsonError('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', 429, {
      'Retry-After': String(limit.retryAfter),
    });
  }
  return null;
}

/**
 * lat/lng 쿼리 파싱.
 * - 둘 다 없으면 { coords: null }
 * - 하나만 있거나 범위를 벗어나면 { error }
 */
export function parseCoords(
  searchParams: URLSearchParams,
  required: boolean
): { coords: { lat: number; lng: number } | null; error?: string } {
  const rawLat = searchParams.get('lat');
  const rawLng = searchParams.get('lng');
  const hasLat = rawLat !== null && rawLat.trim() !== '';
  const hasLng = rawLng !== null && rawLng.trim() !== '';
  if (!hasLat && !hasLng) {
    return required ? { coords: null, error: 'lat, lng가 필요해요' } : { coords: null };
  }
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!hasLat || !hasLng || !isValidCoordinate(lat, lng)) {
    return { coords: null, error: '좌표가 올바르지 않아요' };
  }
  return { coords: { lat, lng } };
}
