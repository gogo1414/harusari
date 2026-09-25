/**
 * 장소 검색 / 역지오코딩 제공자 (서버 전용).
 * - 국내 + KAKAO_REST_API_KEY 설정 시: 카카오 로컬 API
 * - 그 외(해외, 키 미설정, 카카오 장애): Photon(OpenStreetMap, 키 불필요)
 * 외부 API 키가 노출되지 않도록 API 라우트에서만 import 한다.
 */
import type { PlaceResult, LocationProviderName, ReverseGeocodeResponse } from './place';
import { isValidCoordinate } from './types';

export type { PlaceResult, LocationProviderName } from './place';

const KAKAO_BASE = 'https://dapi.kakao.com/v2/local';
const PHOTON_BASE = 'https://photon.komoot.io';
const USER_AGENT = 'harusari-budget-app/1.0';
const REQUEST_TIMEOUT_MS = 5000;

/** 카카오 키워드 검색 결과 수 (최대 15) */
const KAKAO_SEARCH_SIZE = 10;
/** 좌표 기준 키워드 검색 반경(m, 카카오 최대 20000) */
const KAKAO_SEARCH_RADIUS = 20000;
/** 역지오코딩 시 주변 장소 탐색 반경(m) */
const NEARBY_RADIUS_M = 60;
/** 주변 장소 최대 개수 */
const NEARBY_LIMIT = 10;
/** 결제가 자주 일어나는 카카오 카테고리 그룹 */
const KAKAO_NEARBY_CATEGORIES = ['FD6', 'CE7', 'CS2', 'MT1', 'OL7', 'PM9', 'HP8'] as const;

const PHOTON_SEARCH_LIMIT = 8;
/** 도로·교차로 등이 섞여 오므로 넉넉히 받아 거른다 */
const PHOTON_REVERSE_LIMIT = 20;

export class LocationProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: LocationProviderName,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'LocationProviderError';
  }
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ProviderOptions {
  /** 기본값: process.env.KAKAO_REST_API_KEY */
  kakaoKey?: string | null;
  /** 테스트용 fetch 주입 (기본값: 전역 fetch) */
  fetchImpl?: typeof fetch;
}

/** 대한민국 대략적 경계 상자 (제주·울릉·독도 포함) */
export function isInKorea(lat: number, lng: number): boolean {
  return lat >= 33.0 && lat <= 38.7 && lng >= 124.5 && lng <= 131.9;
}

/** 두 좌표 사이 거리(m, 하버사인) */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function resolveKakaoKey(options?: ProviderOptions): string | null {
  const key = options?.kakaoKey !== undefined ? options.kakaoKey : process.env.KAKAO_REST_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

/** 타임아웃이 걸린 JSON GET. 실패 시 LocationProviderError */
async function fetchJson<T>(
  url: string,
  provider: LocationProviderName,
  headers: Record<string, string>,
  options?: ProviderOptions
): Promise<T> {
  const fetchFn = options?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new LocationProviderError(`${provider} responded ${res.status}`, provider, res.status);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof LocationProviderError) throw error;
    const reason = controller.signal.aborted
      ? 'timeout'
      : error instanceof Error
        ? error.message
        : 'unknown';
    throw new LocationProviderError(`${provider} request failed: ${reason}`, provider);
  } finally {
    clearTimeout(timer);
  }
}

function toNumber(value: unknown): number | null {
  // Number('')는 0이므로 빈 문자열은 따로 거른다
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  return Number.isFinite(n) ? n : null;
}

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// ─────────────────────────────── 카카오 ───────────────────────────────

interface KakaoPlaceDocument {
  id?: string;
  place_name?: string;
  category_name?: string;
  category_group_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
  distance?: string;
}

interface KakaoPlaceResponse {
  documents?: KakaoPlaceDocument[];
}

interface KakaoCoord2AddressResponse {
  documents?: Array<{
    address?: { address_name?: string } | null;
    road_address?: { address_name?: string; building_name?: string } | null;
  }>;
}

/** 카카오 장소 문서 → PlaceResult (좌표가 이상하면 null) */
export function mapKakaoPlace(doc: KakaoPlaceDocument): PlaceResult | null {
  const lat = toNumber(doc.y);
  const lng = toNumber(doc.x);
  if (!isValidCoordinate(lat, lng)) return null;
  // category_group_name이 비어 있으면 "음식점 > 카페 > 커피전문점"의 마지막 단계를 사용
  const categoryTail = clean(doc.category_name?.split('>').pop());
  return {
    placeName: clean(doc.place_name),
    address: clean(doc.road_address_name) ?? clean(doc.address_name),
    lat,
    lng: lng as number,
    countryCode: 'KR',
    category: clean(doc.category_group_name) ?? categoryTail,
    distance: toNumber(doc.distance),
  };
}

function kakaoHeaders(key: string) {
  return { Authorization: `KakaoAK ${key}` };
}

/** 카카오 키워드 검색. 좌표가 있으면 반경 20km 거리순, 없으면 정확도순 */
export async function kakaoKeywordSearch(
  query: string,
  key: string,
  near?: Coordinates | null,
  options?: ProviderOptions
): Promise<PlaceResult[]> {
  const run = async (withRadius: boolean) => {
    const params = new URLSearchParams({ query, size: String(KAKAO_SEARCH_SIZE) });
    if (near) {
      params.set('x', String(near.lng));
      params.set('y', String(near.lat));
      if (withRadius) {
        params.set('radius', String(KAKAO_SEARCH_RADIUS));
        params.set('sort', 'distance');
      } else {
        params.set('sort', 'accuracy');
      }
    } else {
      params.set('sort', 'accuracy');
    }
    const data = await fetchJson<KakaoPlaceResponse>(
      `${KAKAO_BASE}/search/keyword.json?${params.toString()}`,
      'kakao',
      kakaoHeaders(key),
      options
    );
    return (data.documents ?? []).map(mapKakaoPlace).filter((p): p is PlaceResult => p !== null);
  };

  const results = await run(Boolean(near));
  // 근처(20km)에 없으면 반경 없이 전국 정확도순으로 한 번 더 (다른 지역 지출을 나중에 입력하는 경우)
  if (results.length === 0 && near) return run(false);
  return results;
}

/** 카카오 역지오코딩: 주소 + 반경 60m 내 주요 업종 장소 */
export async function kakaoReverse(
  lat: number,
  lng: number,
  key: string,
  options?: ProviderOptions
): Promise<Omit<ReverseGeocodeResponse, 'provider'>> {
  const headers = kakaoHeaders(key);
  const xy = `x=${encodeURIComponent(String(lng))}&y=${encodeURIComponent(String(lat))}`;

  const [addressResult, ...categoryResults] = await Promise.allSettled([
    fetchJson<KakaoCoord2AddressResponse>(
      `${KAKAO_BASE}/geo/coord2address.json?${xy}`,
      'kakao',
      headers,
      options
    ),
    ...KAKAO_NEARBY_CATEGORIES.map((code) =>
      fetchJson<KakaoPlaceResponse>(
        `${KAKAO_BASE}/search/category.json?category_group_code=${code}&${xy}&radius=${NEARBY_RADIUS_M}&sort=distance&size=5`,
        'kakao',
        headers,
        options
      )
    ),
  ]);

  // 모든 요청이 실패하면(키 오류, 장애 등) 호출부가 Photon으로 폴백할 수 있도록 throw
  const allFailed =
    addressResult.status === 'rejected' && categoryResults.every((r) => r.status === 'rejected');
  if (allFailed) {
    throw addressResult.reason instanceof LocationProviderError
      ? addressResult.reason
      : new LocationProviderError('kakao reverse failed', 'kakao');
  }

  let address: string | null = null;
  if (addressResult.status === 'fulfilled') {
    const doc = addressResult.value.documents?.[0];
    address = clean(doc?.road_address?.address_name) ?? clean(doc?.address?.address_name);
  }

  const seen = new Set<string>();
  const places: PlaceResult[] = [];
  for (const result of categoryResults) {
    if (result.status !== 'fulfilled') continue;
    for (const doc of result.value.documents ?? []) {
      const dedupeKey = doc.id ?? `${doc.place_name}|${doc.x}|${doc.y}`;
      if (seen.has(dedupeKey)) continue;
      const place = mapKakaoPlace(doc);
      if (!place) continue;
      seen.add(dedupeKey);
      if (place.distance === null || place.distance === undefined) {
        place.distance = Math.round(distanceMeters({ lat, lng }, place));
      }
      places.push(place);
    }
  }
  places.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  return { address, countryCode: 'KR', places: places.slice(0, NEARBY_LIMIT) };
}

// ─────────────────────────────── Photon ───────────────────────────────

export interface PhotonProperties {
  name?: string;
  street?: string;
  housenumber?: string;
  locality?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  postcode?: string;
  osm_key?: string;
  osm_value?: string;
  type?: string;
}

interface PhotonFeature {
  properties?: PhotonProperties;
  geometry?: { type?: string; coordinates?: [number, number] };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

/** 주소 표기에서 번지를 앞에 쓰는 나라 */
const HOUSENUMBER_FIRST = new Set([
  'US',
  'GB',
  'FR',
  'CA',
  'AU',
  'NZ',
  'IE',
  'SG',
  'PH',
  'MY',
  'TH',
  'IN',
  'ZA',
]);

/**
 * 주변 장소(역지오코딩)로 보여줄 OSM 키.
 * 카카오 쪽이 음식점·카페·편의점 등 소비 업종만 주는 것과 맞추기 위해
 * 도로·교차로·정류장·기념물·안내판 등은 제외한다 (검색에서는 모두 허용).
 */
const NEARBY_POI_KEYS = new Set(['amenity', 'shop', 'tourism', 'leisure', 'craft', 'healthcare']);
/** 위 키 중에서도 결제와 무관한 시설 */
const NEARBY_EXCLUDED_VALUES = new Set([
  'bench',
  'clock',
  'waste_basket',
  'waste_disposal',
  'recycling',
  'bicycle_parking',
  'motorcycle_parking',
  'parking_entrance',
  'parking_space',
  'fountain',
  'drinking_water',
  'toilets',
  'post_box',
  'telephone',
  'shelter',
  'vending_machine',
  'townhall',
  'social_facility',
  'place_of_worship',
  'grave_yard',
  'school',
  'kindergarten',
  'police',
  'fire_station',
  'artwork',
  'information',
  'viewpoint',
  'picnic_site',
  'playground',
  'park',
  'garden',
  'pitch',
]);

/** 자주 쓰는 OSM 분류 → 한글 */
const OSM_CATEGORY_KO: Record<string, string> = {
  cafe: '카페',
  restaurant: '음식점',
  fast_food: '패스트푸드',
  food_court: '푸드코트',
  bar: '술집',
  pub: '술집',
  biergarten: '술집',
  ice_cream: '아이스크림',
  bakery: '베이커리',
  confectionery: '과자점',
  library: '도서관',
  convenience: '편의점',
  supermarket: '마트',
  department_store: '백화점',
  mall: '쇼핑몰',
  clothes: '의류',
  shoes: '신발',
  cosmetics: '화장품',
  books: '서점',
  electronics: '전자제품',
  mobile_phone: '휴대폰',
  gift: '기념품',
  pharmacy: '약국',
  chemist: '약국',
  hospital: '병원',
  clinic: '병원',
  doctors: '병원',
  dentist: '치과',
  fuel: '주유소',
  parking: '주차장',
  hotel: '숙박',
  hostel: '숙박',
  guest_house: '숙박',
  motel: '숙박',
  station: '역',
  stop: '정류장',
  subway_entrance: '역 출입구',
  bus_stop: '버스정류장',
  aerodrome: '공항',
  cinema: '영화관',
  theatre: '공연장',
  museum: '박물관',
  attraction: '관광명소',
  bank: '은행',
  atm: 'ATM',
  post_office: '우체국',
  hairdresser: '미용실',
  beauty: '뷰티',
  laundry: '세탁소',
  fitness_centre: '헬스장',
  marketplace: '시장',
  townhall: '관공서',
};

function photonCategory(props: PhotonProperties): string | null {
  const value = clean(props.osm_value);
  if (!value || value === 'yes') return null;
  return OSM_CATEGORY_KO[value] ?? value.replace(/_/g, ' ');
}

function dedupeParts(parts: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const p of parts) {
    const v = clean(p);
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Photon 속성으로 사람이 읽는 주소를 만든다.
 * - 한국: "서울특별시 역삼1동 테헤란로 152" (큰 단위 → 작은 단위, 공백 구분)
 * - 그 외: "6 Place de l'Hôtel de Ville, Paris, France" (작은 단위 → 큰 단위, 쉼표 구분)
 */
export function buildPhotonAddress(props: PhotonProperties): string | null {
  const countryCode = clean(props.countrycode)?.toUpperCase() ?? null;
  // 도로 자체가 결과인 경우 name이 도로명
  const street = clean(props.street) ?? (props.type === 'street' ? clean(props.name) : null);
  const housenumber = clean(props.housenumber);

  if (countryCode === 'KR') {
    const parts = dedupeParts([
      props.city ?? props.state,
      props.district ?? props.locality,
      street,
      street ? housenumber : null,
    ]);
    return parts.length > 0 ? parts.join(' ') : null;
  }

  let streetLine: string | null = null;
  if (street && /^\d+$/.test(street)) {
    // 일본식 블록 번호(丁目-番-号): 동네명 + 번-호
    streetLine = dedupeParts([
      props.locality ?? props.district,
      housenumber ? `${street}-${housenumber}` : street,
    ]).join(' ');
  } else if (street) {
    streetLine = housenumber
      ? countryCode && HOUSENUMBER_FIRST.has(countryCode)
        ? `${housenumber} ${street}`
        : `${street} ${housenumber}`
      : street;
  }
  const parts = dedupeParts([
    streetLine ?? props.locality ?? props.district,
    props.city ?? props.county ?? props.state,
    props.country,
  ]);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Photon feature → PlaceResult (좌표가 이상하면 null) */
export function mapPhotonFeature(
  feature: PhotonFeature,
  origin?: Coordinates | null
): PlaceResult | null {
  const coords = feature.geometry?.coordinates;
  const lng = toNumber(coords?.[0]);
  const lat = toNumber(coords?.[1]);
  if (!isValidCoordinate(lat, lng)) return null;
  const point = { lat, lng: lng as number };
  const props = feature.properties ?? {};
  // 도로/행정구역 결과는 장소명 대신 주소로만 취급
  const isPoi = props.type === 'house' || props.type === undefined;
  return {
    placeName: isPoi ? clean(props.name) : null,
    address: buildPhotonAddress(props),
    ...point,
    countryCode: clean(props.countrycode)?.toUpperCase() ?? null,
    category: isPoi ? photonCategory(props) : null,
    distance: origin ? Math.round(distanceMeters(origin, point)) : null,
  };
}

function photonHeaders() {
  return { 'User-Agent': USER_AGENT };
}

/** Photon 검색. lang을 생략해 현지 표기(한국은 한글) 이름을 받는다 */
export async function photonSearch(
  query: string,
  near?: Coordinates | null,
  options?: ProviderOptions
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(PHOTON_SEARCH_LIMIT) });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
  }
  const data = await fetchJson<PhotonResponse>(
    `${PHOTON_BASE}/api/?${params.toString()}`,
    'photon',
    photonHeaders(),
    options
  );
  return (data.features ?? [])
    .map((f) => mapPhotonFeature(f, near))
    .filter((p): p is PlaceResult => p !== null && Boolean(p.placeName || p.address));
}

/** Photon 역지오코딩: 가장 가까운 주소 + 반경 내 이름 있는 장소 */
export async function photonReverse(
  lat: number,
  lng: number,
  options?: ProviderOptions
): Promise<Omit<ReverseGeocodeResponse, 'provider'>> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    limit: String(PHOTON_REVERSE_LIMIT),
    // radius 단위는 km
    radius: String(NEARBY_RADIUS_M / 1000 + 0.02),
  });
  const data = await fetchJson<PhotonResponse>(
    `${PHOTON_BASE}/reverse?${params.toString()}`,
    'photon',
    photonHeaders(),
    options
  );
  const features = data.features ?? [];
  const origin = { lat, lng };

  // 주소: 거리/번지가 있는 첫 결과 우선
  const addressFeature =
    features.find(
      (f) => f.properties?.street || f.properties?.housenumber || f.properties?.type === 'street'
    ) ?? features[0];
  const address = addressFeature?.properties ? buildPhotonAddress(addressFeature.properties) : null;
  const countryCode = clean(features[0]?.properties?.countrycode)?.toUpperCase() ?? null;

  const seen = new Set<string>();
  const places: PlaceResult[] = [];
  for (const feature of features) {
    const props = feature.properties;
    if (!props?.name || !props.osm_key || !NEARBY_POI_KEYS.has(props.osm_key)) continue;
    if (props.osm_value && NEARBY_EXCLUDED_VALUES.has(props.osm_value)) continue;
    if (props.type && props.type !== 'house') continue;
    const place = mapPhotonFeature(feature, origin);
    if (!place?.placeName) continue;
    // 같은 이름의 노드가 여러 개(예: 역 출입구)면 가장 가까운 하나만
    const dedupeKey = `${place.placeName}|${place.category ?? ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    places.push(place);
  }
  places.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  return { address, countryCode, places: places.slice(0, NEARBY_LIMIT) };
}

// ─────────────────────────────── 진입점 ───────────────────────────────

/**
 * 장소 검색.
 * - 좌표가 있으면: 국내 + 카카오 키 → 카카오, 아니면 Photon
 * - 좌표가 없으면: 카카오 키가 있으면 카카오 먼저, 결과가 없으면 Photon
 * 카카오 실패/0건이면 Photon으로 폴백한다.
 */
export async function searchPlaces(
  params: { query: string; lat?: number | null; lng?: number | null },
  options?: ProviderOptions
): Promise<{ results: PlaceResult[]; provider: LocationProviderName }> {
  const query = params.query.trim();
  const near =
    typeof params.lat === 'number' && typeof params.lng === 'number'
      ? { lat: params.lat, lng: params.lng }
      : null;
  const kakaoKey = resolveKakaoKey(options);
  const useKakao = Boolean(kakaoKey) && (near ? isInKorea(near.lat, near.lng) : true);

  if (useKakao && kakaoKey) {
    try {
      const results = await kakaoKeywordSearch(query, kakaoKey, near, options);
      if (results.length > 0) return { results, provider: 'kakao' };
    } catch (error) {
      console.error('[location] kakao search failed, falling back to photon:', error);
    }
  }

  const results = await photonSearch(query, near, options);
  return { results, provider: 'photon' };
}

/** 좌표 → 주소 + 주변 장소. 국내 + 카카오 키면 카카오, 실패 시 Photon */
export async function reverseGeocode(
  lat: number,
  lng: number,
  options?: ProviderOptions
): Promise<ReverseGeocodeResponse> {
  const kakaoKey = resolveKakaoKey(options);
  if (kakaoKey && isInKorea(lat, lng)) {
    try {
      const result = await kakaoReverse(lat, lng, kakaoKey, options);
      return { ...result, provider: 'kakao' };
    } catch (error) {
      console.error('[location] kakao reverse failed, falling back to photon:', error);
    }
  }
  const result = await photonReverse(lat, lng, options);
  return { ...result, provider: 'photon' };
}
