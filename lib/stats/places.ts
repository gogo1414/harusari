/**
 * 지출 장소 집계 유틸 (순수 함수).
 *
 * 위치(좌표)가 있는 지출 거래를 "장소" 단위로 묶고, 순위/지역 요약/지도 범위를 계산한다.
 * - 장소명이 있으면: 정규화된 장소명이 같고 서로 약 50m 이내면 한 장소
 *   (좌표 반올림 격자만 쓰면 GPS 오차로 경계 양쪽에 찍힌 같은 가게가 둘로 갈라진다)
 * - 장소명이 없으면: 약 100m 이내 좌표끼리 묶고 주소로 라벨링
 * - 국내(KR)는 시/구 단위, 해외는 국가 단위로 지역 요약
 */

/** 국내 판정 기준 국가 코드 */
export const HOME_COUNTRY = 'KR';

/** 장소 집계에 필요한 거래 필드 (Transaction Row의 부분집합) */
export interface PlaceTransactionInput {
  transaction_id: string;
  amount: number;
  type: 'income' | 'expense';
  category_id: string | null;
  date: string;
  place_name?: string | null;
  place_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  country_code?: string | null;
}

export interface SpendingPlace {
  /** 그룹 키 (안정적인 식별자) */
  key: string;
  /** 표시 이름 (장소명 → 주소 → '이름 없는 장소') */
  name: string;
  /** 장소명이 실제로 있는지 (없으면 name은 주소 기반 라벨) */
  hasName: boolean;
  address: string | null;
  /** 그룹에 속한 좌표의 평균 */
  lat: number;
  lng: number;
  /** ISO 3166-1 alpha-2. 저장값이 없으면 국내 좌표 범위로 추정, 그래도 모르면 null */
  countryCode: string | null;
  totalAmount: number;
  count: number;
  /** 마지막 방문일 (yyyy-MM-dd) */
  lastDate: string;
  /** 이 장소에서 가장 많이 쓴 카테고리 (금액 기준) */
  topCategoryId: string | null;
  transactionIds: string[];
}

export interface AggregatePlacesOptions {
  /** true를 반환한 거래는 제외 (예: 저축 거래) */
  exclude?: (t: PlaceTransactionInput) => boolean;
}

/** 같은 이름의 장소를 한 곳으로 볼 최대 거리 */
const NAMED_MERGE_METERS = 50;
/** 이름 없는 좌표를 한 곳으로 묶을 최대 거리 */
const UNNAMED_MERGE_METERS = 100;

/** 두 좌표 사이 거리(m) — 짧은 거리용 등장방형 근사 */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const x = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

// 대한민국 대략적 범위 (country_code가 비어 있을 때만 추정에 사용)
const KR_BOUNDS = { south: 33.0, north: 38.7, west: 124.5, east: 131.9 };

function isFiniteCoord(lat: unknown, lng: unknown): boolean {
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

/** 장소명 정규화: 공백 정리 + 소문자 (그룹 키 용도) */
export function normalizePlaceName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** 저장된 국가 코드를 정규화하고, 없으면 좌표로 국내 여부를 추정 */
export function resolveCountryCode(code: string | null | undefined, lat: number, lng: number): string | null {
  const trimmed = code?.trim().toUpperCase();
  if (trimmed && /^[A-Z]{2}$/.test(trimmed)) return trimmed;
  if (lat >= KR_BOUNDS.south && lat <= KR_BOUNDS.north && lng >= KR_BOUNDS.west && lng <= KR_BOUNDS.east) {
    return HOME_COUNTRY;
  }
  return null;
}

interface PlaceAccumulator {
  key: string;
  latSum: number;
  lngSum: number;
  totalAmount: number;
  count: number;
  lastDate: string;
  // 가장 최근 거래의 이름/주소를 대표값으로 사용
  latestName: string | null;
  latestAddress: string | null;
  latestDate: string;
  countryCounts: Map<string | null, number>;
  categoryAmounts: Map<string | null, number>;
  transactionIds: string[];
}

/**
 * 좌표가 있는 지출 거래를 장소 단위로 집계한다. 결과는 금액 내림차순.
 */
export function aggregatePlaces(
  transactions: readonly PlaceTransactionInput[],
  options: AggregatePlacesOptions = {}
): SpendingPlace[] {
  const groups = new Map<string, PlaceAccumulator>();
  // 이름(또는 '이름 없음')별 후보 클러스터 목록
  const clustersByName = new Map<string, PlaceAccumulator[]>();

  // 입력 순서와 무관하게 같은 결과(키 포함)가 나오도록 날짜·id 순으로 처리
  const sorted = [...transactions].sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.transaction_id.localeCompare(b.transaction_id))
  );

  for (const t of sorted) {
    if (t.type !== 'expense') continue;
    if (!isFiniteCoord(t.latitude, t.longitude)) continue;
    if (options.exclude?.(t)) continue;

    const lat = t.latitude as number;
    const lng = t.longitude as number;
    const rawName = t.place_name?.trim() || null;
    const address = t.place_address?.trim() || null;

    const nameKey = rawName ? `n:${normalizePlaceName(rawName)}` : 'g:';
    const radius = rawName ? NAMED_MERGE_METERS : UNNAMED_MERGE_METERS;
    const candidates = clustersByName.get(nameKey) ?? [];
    let acc = candidates.find(
      (c) => distanceMeters(c.latSum / c.count, c.lngSum / c.count, lat, lng) <= radius
    );
    if (!acc) {
      const key = `${nameKey}@${lat.toFixed(4)},${lng.toFixed(4)}`;
      acc = {
        key,
        latSum: 0,
        lngSum: 0,
        totalAmount: 0,
        count: 0,
        lastDate: t.date,
        latestName: rawName,
        latestAddress: address,
        latestDate: t.date,
        countryCounts: new Map(),
        categoryAmounts: new Map(),
        transactionIds: [],
      };
      groups.set(key, acc);
      candidates.push(acc);
      clustersByName.set(nameKey, candidates);
    }

    acc.latSum += lat;
    acc.lngSum += lng;
    acc.totalAmount += t.amount;
    acc.count += 1;
    acc.transactionIds.push(t.transaction_id);
    if (t.date > acc.lastDate) acc.lastDate = t.date;
    // 최근 거래의 이름/주소로 갱신 (빈 값은 기존 값 유지)
    if (t.date >= acc.latestDate) {
      acc.latestDate = t.date;
      if (rawName) acc.latestName = rawName;
      if (address) acc.latestAddress = address;
    } else {
      if (!acc.latestName && rawName) acc.latestName = rawName;
      if (!acc.latestAddress && address) acc.latestAddress = address;
    }

    const country = resolveCountryCode(t.country_code, lat, lng);
    acc.countryCounts.set(country, (acc.countryCounts.get(country) ?? 0) + 1);
    const cat = t.category_id ?? null;
    acc.categoryAmounts.set(cat, (acc.categoryAmounts.get(cat) ?? 0) + t.amount);
  }

  const places: SpendingPlace[] = [];
  for (const acc of groups.values()) {
    const name = acc.latestName ?? acc.latestAddress ?? '이름 없는 장소';
    places.push({
      key: acc.key,
      name,
      hasName: !!acc.latestName,
      address: acc.latestAddress,
      lat: acc.latSum / acc.count,
      lng: acc.lngSum / acc.count,
      countryCode: pickMax(acc.countryCounts),
      totalAmount: acc.totalAmount,
      count: acc.count,
      lastDate: acc.lastDate,
      topCategoryId: pickMax(acc.categoryAmounts),
      transactionIds: acc.transactionIds,
    });
  }

  return rankPlaces(places, 'amount');
}

/** Map에서 값이 가장 큰 키 (동률이면 먼저 들어온 키, null 키는 다른 키가 없을 때만) */
function pickMax<K>(map: Map<K, number>): K | null {
  let bestKey: K | null = null;
  let bestValue = -Infinity;
  for (const [key, value] of map) {
    if (key === null) continue;
    if (value > bestValue) {
      bestKey = key;
      bestValue = value;
    }
  }
  return bestKey;
}

export type PlaceRankBy = 'amount' | 'count';

/** 장소 순위 (원본 배열은 변경하지 않음) */
export function rankPlaces(places: readonly SpendingPlace[], by: PlaceRankBy): SpendingPlace[] {
  return [...places].sort((a, b) => {
    const primary = by === 'amount' ? b.totalAmount - a.totalAmount : b.count - a.count;
    if (primary !== 0) return primary;
    const secondary = by === 'amount' ? b.count - a.count : b.totalAmount - a.totalAmount;
    if (secondary !== 0) return secondary;
    if (a.lastDate !== b.lastDate) return a.lastDate < b.lastDate ? 1 : -1;
    return a.name.localeCompare(b.name, 'ko');
  });
}

// ─── 지역 요약 ───────────────────────────────────────────────

// 시/도 정식 명칭 → 짧은 이름
const KR_PROVINCES: Record<string, string> = {
  서울특별시: '서울',
  서울시: '서울',
  서울: '서울',
  부산광역시: '부산',
  부산시: '부산',
  부산: '부산',
  대구광역시: '대구',
  대구시: '대구',
  대구: '대구',
  인천광역시: '인천',
  인천시: '인천',
  인천: '인천',
  광주광역시: '광주',
  광주: '광주',
  대전광역시: '대전',
  대전시: '대전',
  대전: '대전',
  울산광역시: '울산',
  울산시: '울산',
  울산: '울산',
  세종특별자치시: '세종',
  세종시: '세종',
  세종: '세종',
  경기도: '경기',
  경기: '경기',
  강원도: '강원',
  강원특별자치도: '강원',
  강원: '강원',
  충청북도: '충북',
  충북: '충북',
  충청남도: '충남',
  충남: '충남',
  전라북도: '전북',
  전북특별자치도: '전북',
  전북: '전북',
  전라남도: '전남',
  전남: '전남',
  경상북도: '경북',
  경북: '경북',
  경상남도: '경남',
  경남: '경남',
  제주특별자치도: '제주',
  제주도: '제주',
  제주: '제주',
};

export interface KoreanRegion {
  /** 시/도 짧은 이름 (예: 서울, 경기) */
  city: string | null;
  /** 시/군/구 (예: 강남구, 성남시 분당구) */
  district: string | null;
}

/**
 * 국내 주소에서 시/도와 시/군/구를 추출한다.
 * '서울 강남구 테헤란로 1', '서울특별시 강남구 …' → { city: '서울', district: '강남구' }
 * '경기 성남시 분당구 …' → { city: '경기', district: '성남시 분당구' }
 */
export function parseKoreanRegion(address: string | null | undefined): KoreanRegion {
  if (!address) return { city: null, district: null };
  const tokens = address.trim().split(/\s+/).filter(Boolean);
  if (tokens[0] === '대한민국' || tokens[0] === '한국') tokens.shift();
  if (tokens.length === 0) return { city: null, district: null };

  let index = 0;
  let city: string | null = null;
  if (KR_PROVINCES[tokens[0]]) {
    city = KR_PROVINCES[tokens[0]];
    index = 1;
  }

  let district: string | null = null;
  const first = tokens[index];
  if (first && /(시|군|구)$/.test(first) && !KR_PROVINCES[first]) {
    district = first;
    // 일반구가 있는 시 (예: 성남시 분당구, 수원시 팔달구)
    const next = tokens[index + 1];
    if (first.endsWith('시') && next && /구$/.test(next)) {
      district = `${first} ${next}`;
    }
  }

  return { city, district };
}

/** 국가 코드 → 국기 이모지 (Regional Indicator) */
export function flagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode || !/^[A-Za-z]{2}$/.test(countryCode)) return '🌐';
  const upper = countryCode.toUpperCase();
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

let regionNames: Intl.DisplayNames | null | undefined;

/** 국가 코드 → 한국어 국가명 (예: JP → 일본) */
export function countryName(countryCode: string | null | undefined): string {
  if (!countryCode) return '알 수 없는 지역';
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['ko'], { type: 'region' });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase();
  } catch {
    return countryCode.toUpperCase();
  }
}

export interface RegionSummary {
  key: string;
  /** 칩에 표시할 이름 (예: 강남구, 일본) */
  label: string;
  /** 보조 설명 (예: 서울). 해외는 null */
  sublabel: string | null;
  countryCode: string | null;
  isDomestic: boolean;
  /** 해외 지역에만 국기 */
  flag: string | null;
  totalAmount: number;
  count: number;
  placeCount: number;
  placeKeys: string[];
}

function addToRegion(
  map: Map<string, RegionSummary>,
  base: Omit<RegionSummary, 'totalAmount' | 'count' | 'placeCount' | 'placeKeys'>,
  place: SpendingPlace
) {
  const region = map.get(base.key) ?? { ...base, totalAmount: 0, count: 0, placeCount: 0, placeKeys: [] };
  region.totalAmount += place.totalAmount;
  region.count += place.count;
  region.placeCount += 1;
  region.placeKeys.push(place.key);
  map.set(base.key, region);
}

/**
 * 지역별 요약: 국내는 시/군/구, 해외는 국가 단위. 금액 내림차순.
 */
export function summarizeRegions(places: readonly SpendingPlace[]): RegionSummary[] {
  const map = new Map<string, RegionSummary>();
  for (const place of places) {
    if (place.countryCode === HOME_COUNTRY) {
      const { city, district } = parseKoreanRegion(place.address);
      const label = district ?? city ?? '국내 기타';
      addToRegion(
        map,
        {
          key: `KR:${city ?? ''}:${district ?? ''}`,
          label,
          sublabel: district ? city : null,
          countryCode: HOME_COUNTRY,
          isDomestic: true,
          flag: null,
        },
        place
      );
    } else {
      addToRegion(
        map,
        {
          key: `C:${place.countryCode ?? '??'}`,
          label: countryName(place.countryCode),
          sublabel: null,
          countryCode: place.countryCode,
          isDomestic: false,
          flag: flagEmoji(place.countryCode),
        },
        place
      );
    }
  }
  return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount || b.count - a.count);
}

export interface CountrySummary {
  /** 칩 선택용 식별자 (countryKey와 동일) */
  id: string;
  countryCode: string | null;
  /** 국내는 '국내', 해외는 국가명 */
  label: string;
  flag: string;
  isDomestic: boolean;
  totalAmount: number;
  count: number;
  placeCount: number;
}

/** 국가별 요약 (지도 빠른 이동 칩 용도). 금액 내림차순. */
export function summarizeCountries(places: readonly SpendingPlace[]): CountrySummary[] {
  const map = new Map<string, CountrySummary>();
  for (const place of places) {
    const id = countryKey(place);
    const isDomestic = place.countryCode === HOME_COUNTRY;
    const summary = map.get(id) ?? {
      id,
      countryCode: place.countryCode,
      label: isDomestic ? '국내' : countryName(place.countryCode),
      flag: flagEmoji(place.countryCode),
      isDomestic,
      totalAmount: 0,
      count: 0,
      placeCount: 0,
    };
    summary.totalAmount += place.totalAmount;
    summary.count += place.count;
    summary.placeCount += 1;
    map.set(id, summary);
  }
  return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount || b.count - a.count);
}

// ─── 지도 범위 ───────────────────────────────────────────────

export interface GeoBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** 좌표 목록을 감싸는 범위. 빈 목록이면 null */
export function computeBounds(points: readonly { lat: number; lng: number }[]): GeoBounds | null {
  let bounds: GeoBounds | null = null;
  for (const { lat, lng } of points) {
    if (!isFiniteCoord(lat, lng)) continue;
    if (!bounds) {
      bounds = { south: lat, north: lat, west: lng, east: lng };
    } else {
      bounds.south = Math.min(bounds.south, lat);
      bounds.north = Math.max(bounds.north, lat);
      bounds.west = Math.min(bounds.west, lng);
      bounds.east = Math.max(bounds.east, lng);
    }
  }
  return bounds;
}

/** 국가 칩 식별자 (국가 코드를 모르면 '??') */
export function countryKey(place: Pick<SpendingPlace, 'countryCode'>): string {
  return place.countryCode ?? '??';
}

/** 지정한 국가의 장소만 (null이면 전체) */
export function placesInCountry(places: readonly SpendingPlace[], id: string | null): SpendingPlace[] {
  if (id === null) return [...places];
  return places.filter((p) => countryKey(p) === id);
}
