import type { TransactionLocation } from './types';

/**
 * 장소 검색/주변 장소 결과 (클라이언트·서버 공용 타입).
 * TransactionLocation에 표시용 부가 정보(분류, 거리)를 더한 형태.
 */
export interface PlaceResult extends TransactionLocation {
  /** 장소 분류 (예: 카페, 편의점). 없으면 null */
  category?: string | null;
  /** 기준 좌표로부터의 거리(m). 기준 좌표가 없으면 null */
  distance?: number | null;
}

export type LocationProviderName = 'kakao' | 'photon';

/** GET /api/location/search 응답 */
export interface PlaceSearchResponse {
  results: PlaceResult[];
  provider: LocationProviderName;
}

/** GET /api/location/reverse 응답 */
export interface ReverseGeocodeResponse {
  address: string | null;
  countryCode: string | null;
  places: PlaceResult[];
  provider: LocationProviderName;
}

/** 표시용 부가 정보를 떼어내고 저장용 위치 값만 남긴다 */
export function toTransactionLocation(place: PlaceResult): TransactionLocation {
  return {
    placeName: place.placeName,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    countryCode: place.countryCode,
  };
}

/** 거리 표시 (예: 35m, 1.2km) */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.max(0, Math.round(meters))}m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`;
}
