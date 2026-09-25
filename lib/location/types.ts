/**
 * 거래 위치 정보 공용 타입.
 * DB 컬럼: transactions.place_name / place_address / latitude / longitude / country_code
 */
export interface TransactionLocation {
  /** 상호/장소명 (예: GS25 역삼점). 좌표만 있으면 null */
  placeName: string | null;
  /** 도로명/지번 주소 등 사람이 읽는 주소 */
  address: string | null;
  lat: number;
  lng: number;
  /** ISO 3166-1 alpha-2 (예: KR, JP). 모르면 null */
  countryCode: string | null;
}

export interface LocationColumns {
  place_name: string | null;
  place_address: string | null;
  latitude: number | null;
  longitude: number | null;
  country_code: string | null;
}

export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** 폼의 위치 값 → DB 컬럼. undefined면 컬럼을 건드리지 않고(빈 객체), null이면 위치 삭제 */
export function locationColumns(loc: TransactionLocation | null | undefined): Partial<LocationColumns> {
  if (loc === undefined) return {};
  if (loc === null || !isValidCoordinate(loc.lat, loc.lng)) {
    return { place_name: null, place_address: null, latitude: null, longitude: null, country_code: null };
  }
  return {
    place_name: loc.placeName?.trim().slice(0, 120) || null,
    place_address: loc.address?.trim().slice(0, 200) || null,
    latitude: Math.round(loc.lat * 1e6) / 1e6,
    longitude: Math.round(loc.lng * 1e6) / 1e6,
    country_code: loc.countryCode ? loc.countryCode.toUpperCase().slice(0, 2) : null,
  };
}

/** DB 행 → 폼 위치 값 */
export function locationFromRow(row: Partial<LocationColumns> | null | undefined): TransactionLocation | null {
  if (!row || !isValidCoordinate(row.latitude, row.longitude)) return null;
  return {
    placeName: row.place_name ?? null,
    address: row.place_address ?? null,
    lat: row.latitude as number,
    lng: row.longitude as number,
    countryCode: row.country_code ?? null,
  };
}
