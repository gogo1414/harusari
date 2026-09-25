import {
  aggregatePlaces,
  distanceMeters,
  computeBounds,
  countryName,
  flagEmoji,
  parseKoreanRegion,
  placesInCountry,
  rankPlaces,
  resolveCountryCode,
  summarizeCountries,
  summarizeRegions,
  type PlaceTransactionInput,
} from './places';

let seq = 0;
function tx(partial: Partial<PlaceTransactionInput>): PlaceTransactionInput {
  seq += 1;
  return {
    transaction_id: `t${seq}`,
    amount: 10000,
    type: 'expense',
    category_id: 'food',
    date: '2026-09-10',
    place_name: null,
    place_address: null,
    latitude: null,
    longitude: null,
    country_code: null,
    ...partial,
  };
}

// 강남역 부근
const GANGNAM = { latitude: 37.49794, longitude: 127.02762 };
// 성수동
const SEONGSU = { latitude: 37.54447, longitude: 127.05594 };
// 도쿄 시부야
const SHIBUYA = { latitude: 35.65858, longitude: 139.70159 };

describe('aggregatePlaces', () => {
  it('좌표가 없는 거래, 수입, 제외 대상은 무시한다', () => {
    const places = aggregatePlaces(
      [
        tx({ place_name: '스타벅스', ...GANGNAM }),
        tx({ place_name: '위치 없음' }),
        tx({ type: 'income', place_name: '월급', ...GANGNAM }),
        tx({ place_name: '적금', category_id: 'save', ...GANGNAM }),
      ],
      { exclude: (t) => t.category_id === 'save' }
    );
    expect(places).toHaveLength(1);
    expect(places[0].name).toBe('스타벅스');
    expect(places[0].count).toBe(1);
  });

  it('같은 이름(대소문자/공백 차이)과 근접 좌표(반올림 경계를 넘어도)는 한 장소로 묶는다', () => {
    const places = aggregatePlaces([
      tx({ place_name: 'Starbucks  Gangnam', amount: 5000, date: '2026-09-01', ...GANGNAM }),
      tx({
        place_name: 'starbucks gangnam',
        amount: 7000,
        date: '2026-09-05',
        latitude: GANGNAM.latitude + 0.00001,
        longitude: GANGNAM.longitude,
      }),
    ]);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ totalAmount: 12000, count: 2, lastDate: '2026-09-05' });
    // 최근 거래의 표기를 대표 이름으로
    expect(places[0].name).toBe('starbucks gangnam');
    expect(places[0].transactionIds).toHaveLength(2);
  });

  it('입력 순서가 달라도 같은 키/결과', () => {
    const rows = [
      tx({ place_name: '편의점', date: '2026-09-02', ...GANGNAM }),
      tx({ place_name: '편의점', date: '2026-09-01', latitude: GANGNAM.latitude + 0.0002, longitude: GANGNAM.longitude }),
    ];
    const a = aggregatePlaces(rows);
    const b = aggregatePlaces([...rows].reverse());
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
  });

  it('같은 이름이라도 멀리 떨어진 지점은 다른 장소다', () => {
    const places = aggregatePlaces([
      tx({ place_name: 'GS25', ...GANGNAM }),
      tx({ place_name: 'GS25', ...SEONGSU }),
    ]);
    expect(places).toHaveLength(2);
  });

  it('이름이 없으면 약 100m 이내 좌표끼리 묶고 주소로 라벨링한다', () => {
    const places = aggregatePlaces([
      tx({ place_address: '서울 강남구 강남대로 390', latitude: 37.4981, longitude: 127.0276 }),
      tx({ place_address: null, latitude: 37.4984, longitude: 127.0279 }),
      tx({ latitude: 37.5101, longitude: 127.0276 }),
    ]);
    expect(places).toHaveLength(2);
    const grouped = places.find((p) => p.count === 2)!;
    expect(grouped.name).toBe('서울 강남구 강남대로 390');
    expect(grouped.hasName).toBe(false);
    const unnamed = places.find((p) => p.count === 1)!;
    expect(unnamed.name).toBe('이름 없는 장소');
  });

  it('대표 카테고리는 금액 기준, 좌표는 평균', () => {
    const [place] = aggregatePlaces([
      tx({ place_name: '다이소', category_id: 'living', amount: 3000, latitude: 37.5, longitude: 127.0 }),
      tx({ place_name: '다이소', category_id: 'food', amount: 2000, latitude: 37.50004, longitude: 127.00004 }),
      tx({ place_name: '다이소', category_id: 'food', amount: 2000, latitude: 37.50002, longitude: 127.00002 }),
    ]);
    expect(place.topCategoryId).toBe('food');
    expect(place.lat).toBeCloseTo(37.50002, 5);
    expect(place.lng).toBeCloseTo(127.00002, 5);
  });

  it('국가 코드가 없으면 국내 좌표 범위로 KR을 추정한다', () => {
    const places = aggregatePlaces([
      tx({ place_name: '강남', ...GANGNAM }),
      tx({ place_name: '시부야', ...SHIBUYA }),
      tx({ place_name: '도쿄역', latitude: 35.6812, longitude: 139.7671, country_code: 'jp' }),
    ]);
    const byName = Object.fromEntries(places.map((p) => [p.name, p.countryCode]));
    expect(byName).toEqual({ 강남: 'KR', 시부야: null, 도쿄역: 'JP' });
  });

  it('결과는 금액 내림차순', () => {
    const places = aggregatePlaces([
      tx({ place_name: 'A', amount: 1000, ...GANGNAM }),
      tx({ place_name: 'B', amount: 5000, ...SEONGSU }),
    ]);
    expect(places.map((p) => p.name)).toEqual(['B', 'A']);
  });
});

describe('rankPlaces', () => {
  const places = aggregatePlaces([
    tx({ place_name: '비싼곳', amount: 50000, ...GANGNAM }),
    tx({ place_name: '자주가는곳', amount: 3000, ...SEONGSU }),
    tx({ place_name: '자주가는곳', amount: 3000, ...SEONGSU }),
    tx({ place_name: '자주가는곳', amount: 3000, ...SEONGSU }),
  ]);

  it('금액/횟수 기준으로 정렬하고 원본을 바꾸지 않는다', () => {
    expect(rankPlaces(places, 'amount')[0].name).toBe('비싼곳');
    expect(rankPlaces(places, 'count')[0].name).toBe('자주가는곳');
    expect(places[0].name).toBe('비싼곳');
  });

  it('동률이면 보조 기준(금액↔횟수) → 최근 방문 순', () => {
    const tie = aggregatePlaces([
      tx({ place_name: 'X', amount: 1000, date: '2026-09-01', ...GANGNAM }),
      tx({ place_name: 'Y', amount: 1000, date: '2026-09-09', ...SEONGSU }),
    ]);
    expect(rankPlaces(tie, 'count').map((p) => p.name)).toEqual(['Y', 'X']);
  });
});

describe('parseKoreanRegion', () => {
  it.each([
    ['서울 강남구 테헤란로 152', '서울', '강남구'],
    ['서울특별시 강남구 역삼동 737', '서울', '강남구'],
    ['대한민국 서울특별시 성동구 성수이로 1', '서울', '성동구'],
    ['경기 성남시 분당구 판교역로 235', '경기', '성남시 분당구'],
    ['경기도 가평군 청평면', '경기', '가평군'],
    ['부산광역시 해운대구 우동', '부산', '해운대구'],
    ['제주특별자치도 제주시 연동', '제주', '제주시'],
    ['세종특별자치시 한누리대로 2130', '세종', null],
    ['강남구 역삼동', null, '강남구'],
  ])('%s → %s %s', (address, city, district) => {
    expect(parseKoreanRegion(address)).toEqual({ city, district });
  });

  it('빈 주소', () => {
    expect(parseKoreanRegion(null)).toEqual({ city: null, district: null });
    expect(parseKoreanRegion('  ')).toEqual({ city: null, district: null });
  });
});

describe('summarizeRegions / summarizeCountries', () => {
  const places = aggregatePlaces([
    tx({ place_name: '카페A', amount: 10000, place_address: '서울 강남구 테헤란로 1', ...GANGNAM }),
    tx({
      place_name: '식당B',
      amount: 20000,
      place_address: '서울특별시 강남구 강남대로 2',
      latitude: 37.501,
      longitude: 127.03,
    }),
    tx({ place_name: '카페C', amount: 5000, place_address: '서울 성동구 성수이로 3', ...SEONGSU }),
    tx({ place_name: '라멘', amount: 90000, place_address: '東京都渋谷区', country_code: 'JP', ...SHIBUYA }),
    tx({ place_name: '어딘가', amount: 1000, latitude: 48.85, longitude: 2.35 }),
  ]);

  it('국내는 구 단위, 해외는 국가 단위로 묶는다', () => {
    const regions = summarizeRegions(places);
    expect(regions.map((r) => r.label)).toEqual(['일본', '강남구', '성동구', '알 수 없는 지역']);
    const gangnam = regions.find((r) => r.label === '강남구')!;
    expect(gangnam).toMatchObject({ sublabel: '서울', isDomestic: true, totalAmount: 30000, count: 2, placeCount: 2 });
    const japan = regions[0];
    expect(japan).toMatchObject({ isDomestic: false, flag: '🇯🇵', countryCode: 'JP' });
  });

  it('국가 요약: 국내 라벨과 금액 순서', () => {
    const countries = summarizeCountries(places);
    expect(countries.map((c) => c.label)).toEqual(['일본', '국내', '알 수 없는 지역']);
    expect(countries[1]).toMatchObject({ id: 'KR', isDomestic: true, totalAmount: 35000, placeCount: 3 });
    expect(placesInCountry(places, 'KR')).toHaveLength(3);
    expect(placesInCountry(places, '??')).toHaveLength(1);
    expect(placesInCountry(places, null)).toHaveLength(5);
  });
});

describe('국가 유틸', () => {
  it('flagEmoji', () => {
    expect(flagEmoji('KR')).toBe('🇰🇷');
    expect(flagEmoji('jp')).toBe('🇯🇵');
    expect(flagEmoji(null)).toBe('🌐');
  });

  it('countryName (Intl.DisplayNames ko)', () => {
    expect(countryName('JP')).toBe('일본');
    expect(countryName('US')).toBe('미국');
    expect(countryName(null)).toBe('알 수 없는 지역');
  });

  it('resolveCountryCode: 잘못된 코드는 좌표로 추정', () => {
    expect(resolveCountryCode(' kr ', 0, 0)).toBe('KR');
    expect(resolveCountryCode('KOR', 37.5, 127)).toBe('KR');
    expect(resolveCountryCode(null, 35.6, 139.7)).toBeNull();
  });
});

describe('distanceMeters', () => {
  it('강남역~성수 약 5.6km', () => {
    const d = distanceMeters(GANGNAM.latitude, GANGNAM.longitude, SEONGSU.latitude, SEONGSU.longitude);
    expect(d).toBeGreaterThan(5000);
    expect(d).toBeLessThan(6500);
  });
});

describe('computeBounds', () => {
  it('빈 목록은 null', () => {
    expect(computeBounds([])).toBeNull();
  });

  it('모든 점을 감싸고 잘못된 좌표는 건너뛴다', () => {
    expect(
      computeBounds([
        { lat: 37.5, lng: 127.0 },
        { lat: 35.6, lng: 139.7 },
        { lat: Number.NaN, lng: 0 },
      ])
    ).toEqual({ south: 35.6, north: 37.5, west: 127.0, east: 139.7 });
  });

  it('점 하나면 크기 0 범위', () => {
    expect(computeBounds([{ lat: 1, lng: 2 }])).toEqual({ south: 1, north: 1, west: 2, east: 2 });
  });
});
