import type { NextRequest } from 'next/server';
import { reverseGeocode } from '@/lib/location/providers';
import {
  guardRequest,
  jsonError,
  jsonOk,
  parseCoords,
  UPSTREAM_ERROR_MESSAGE,
} from '../_lib/shared';

/**
 * 좌표 → 주소 + 주변 장소.
 * GET /api/location/reverse?lat=&lng=
 * → { address, countryCode, places: PlaceResult[], provider: 'kakao' | 'photon' }
 */
export async function GET(request: NextRequest) {
  const denied = await guardRequest();
  if (denied) return denied;

  const { coords, error } = parseCoords(request.nextUrl.searchParams, true);
  if (error || !coords) return jsonError(error ?? '좌표가 올바르지 않아요', 400);

  try {
    const result = await reverseGeocode(coords.lat, coords.lng);
    return jsonOk(result);
  } catch (err) {
    console.error('[location/reverse] failed:', err);
    return jsonError(UPSTREAM_ERROR_MESSAGE, 502);
  }
}
