import type { NextRequest } from 'next/server';
import { searchPlaces } from '@/lib/location/providers';
import {
  guardRequest,
  jsonError,
  jsonOk,
  parseCoords,
  UPSTREAM_ERROR_MESSAGE,
} from '../_lib/shared';

const MAX_QUERY_LENGTH = 60;

/**
 * 장소 키워드 검색.
 * GET /api/location/search?q=<1~60자>&lat=&lng=
 * → { results: PlaceResult[], provider: 'kakao' | 'photon' }
 * 좌표(선택)는 가까운 곳 우선 정렬(바이어스)에만 사용한다.
 */
export async function GET(request: NextRequest) {
  const denied = await guardRequest();
  if (denied) return denied;

  const { searchParams } = request.nextUrl;
  // 제어 문자 제거 후 공백 정리
  const query = (searchParams.get('q') ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (query.length < 1 || query.length > MAX_QUERY_LENGTH) {
    return jsonError(`검색어는 1~${MAX_QUERY_LENGTH}자로 입력해 주세요`, 400);
  }

  const { coords, error } = parseCoords(searchParams, false);
  if (error) return jsonError(error, 400);

  try {
    const result = await searchPlaces({ query, lat: coords?.lat, lng: coords?.lng });
    return jsonOk(result);
  } catch (err) {
    console.error('[location/search] failed:', err);
    return jsonError(UPSTREAM_ERROR_MESSAGE, 502);
  }
}
