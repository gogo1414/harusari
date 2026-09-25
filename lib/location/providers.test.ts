/**
 * @jest-environment node
 */
import {
  buildPhotonAddress,
  distanceMeters,
  isInKorea,
  kakaoReverse,
  LocationProviderError,
  mapKakaoPlace,
  photonReverse,
  reverseGeocode,
  searchPlaces,
} from './providers';

type Handler = (
  url: string,
  init?: RequestInit
) => { status?: number; body: unknown } | Promise<never>;

/** URL별 응답을 흉내 내는 fetch 목 */
function mockFetch(handler: Handler) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const res = await handler(url, init);
    const status = res.status ?? 200;
    return new Response(JSON.stringify(res.body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl: fn, calls };
}

const kakaoDoc = (overrides: Record<string, string> = {}) => ({
  id: '1',
  place_name: 'GS25 역삼점',
  category_name: '가정,생활 > 편의점 > GS25',
  category_group_name: '편의점',
  address_name: '서울 강남구 역삼동 823',
  road_address_name: '서울 강남구 테헤란로 152',
  x: '127.0360',
  y: '37.5000',
  distance: '25',
  ...overrides,
});

const photonFeature = (props: Record<string, unknown>, coords: [number, number]) => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'Point', coordinates: coords },
});

describe('isInKorea', () => {
  it('서울/제주/독도는 국내, 도쿄/파리는 해외', () => {
    expect(isInKorea(37.5665, 126.978)).toBe(true);
    expect(isInKorea(33.4996, 126.5312)).toBe(true);
    expect(isInKorea(37.2426, 131.8669)).toBe(true);
    expect(isInKorea(35.6812, 139.7671)).toBe(false);
    expect(isInKorea(48.8566, 2.3522)).toBe(false);
  });
});

describe('distanceMeters', () => {
  it('위도 0.001도 ≈ 111m', () => {
    const d = distanceMeters({ lat: 37.5, lng: 127 }, { lat: 37.501, lng: 127 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });
});

describe('카카오 매핑', () => {
  it('도로명 주소 우선, 좌표는 숫자로, 국가코드 KR', () => {
    expect(mapKakaoPlace(kakaoDoc())).toEqual({
      placeName: 'GS25 역삼점',
      address: '서울 강남구 테헤란로 152',
      lat: 37.5,
      lng: 127.036,
      countryCode: 'KR',
      category: '편의점',
      distance: 25,
    });
  });

  it('도로명 주소가 없으면 지번, 그룹명이 없으면 분류 마지막 단계', () => {
    const place = mapKakaoPlace(
      kakaoDoc({
        road_address_name: '',
        category_group_name: '',
        category_name: '음식점 > 카페 > 커피전문점',
        distance: '',
      })
    );
    expect(place?.address).toBe('서울 강남구 역삼동 823');
    expect(place?.category).toBe('커피전문점');
    expect(place?.distance).toBeNull();
  });

  it('좌표가 없으면 제외', () => {
    expect(mapKakaoPlace(kakaoDoc({ x: '' }))).toBeNull();
  });
});

describe('searchPlaces', () => {
  it('국내 좌표 + 카카오 키 → 카카오 키워드 검색 (KakaoAK 헤더, 반경/거리순)', async () => {
    const { fetchImpl, calls } = mockFetch(() => ({ body: { documents: [kakaoDoc()] } }));
    const result = await searchPlaces(
      { query: 'GS25', lat: 37.5, lng: 127.03 },
      { kakaoKey: 'test-key', fetchImpl }
    );
    expect(result.provider).toBe('kakao');
    expect(result.results).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe('https://dapi.kakao.com/v2/local/search/keyword.json');
    expect(url.searchParams.get('query')).toBe('GS25');
    expect(url.searchParams.get('x')).toBe('127.03');
    expect(url.searchParams.get('y')).toBe('37.5');
    expect(url.searchParams.get('radius')).toBe('20000');
    expect(url.searchParams.get('sort')).toBe('distance');
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
      'KakaoAK test-key'
    );
  });

  it('해외 좌표면 카카오 키가 있어도 Photon (lang 미지정, 위치 바이어스, User-Agent)', async () => {
    const { fetchImpl, calls } = mockFetch(() => ({
      body: {
        features: [
          photonFeature(
            {
              name: 'スターバックス',
              osm_key: 'amenity',
              osm_value: 'cafe',
              type: 'house',
              housenumber: '17',
              street: '3',
              district: '港区',
              city: '港区',
              country: '日本',
              countrycode: 'JP',
            },
            [139.7466, 35.6685]
          ),
        ],
      },
    }));
    const result = await searchPlaces(
      { query: 'starbucks', lat: 35.6812, lng: 139.7671 },
      { kakaoKey: 'test-key', fetchImpl }
    );
    expect(result.provider).toBe('photon');
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/');
    expect(url.searchParams.get('lat')).toBe('35.6812');
    expect(url.searchParams.get('lon')).toBe('139.7671');
    expect(url.searchParams.has('lang')).toBe(false);
    expect((calls[0].init?.headers as Record<string, string>)['User-Agent']).toBe(
      'harusari-budget-app/1.0'
    );
    expect(result.results[0]).toMatchObject({
      placeName: 'スターバックス',
      countryCode: 'JP',
      category: '카페',
      lat: 35.6685,
      lng: 139.7466,
    });
    expect(result.results[0].distance).toBeGreaterThan(0);
  });

  it('좌표 없이 카카오가 0건이면 Photon으로 폴백', async () => {
    const { fetchImpl, calls } = mockFetch((url) =>
      url.includes('dapi.kakao.com')
        ? { body: { documents: [] } }
        : {
            body: {
              features: [
                photonFeature({ name: 'Louvre', type: 'house', countrycode: 'FR' }, [2.33, 48.86]),
              ],
            },
          }
    );
    const result = await searchPlaces({ query: 'Louvre' }, { kakaoKey: 'k', fetchImpl });
    expect(result.provider).toBe('photon');
    expect(calls.map((c) => new URL(c.url).host)).toEqual(['dapi.kakao.com', 'photon.komoot.io']);
  });

  it('카카오 키가 없으면 국내여도 Photon', async () => {
    const { fetchImpl, calls } = mockFetch(() => ({ body: { features: [] } }));
    const result = await searchPlaces(
      { query: '스타벅스', lat: 37.5, lng: 127 },
      { kakaoKey: null, fetchImpl }
    );
    expect(result).toEqual({ results: [], provider: 'photon' });
    expect(new URL(calls[0].url).host).toBe('photon.komoot.io');
  });

  it('카카오·Photon 모두 5xx면 LocationProviderError를 throw', async () => {
    const { fetchImpl } = mockFetch(() => ({ status: 500, body: {} }));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(searchPlaces({ query: 'x' }, { kakaoKey: 'k', fetchImpl })).rejects.toBeInstanceOf(
      LocationProviderError
    );
    spy.mockRestore();
  });

  it('네트워크 오류도 LocationProviderError로 감싼다', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(searchPlaces({ query: 'x' }, { kakaoKey: null, fetchImpl })).rejects.toThrow(
      /photon request failed/
    );
  });
});

describe('buildPhotonAddress', () => {
  it('한국: 큰 단위 → 작은 단위, 공백 구분', () => {
    expect(
      buildPhotonAddress({
        name: '스타벅스',
        street: '강남대로',
        housenumber: '456',
        district: '역삼1동',
        city: '서울특별시',
        country: '대한민국',
        countrycode: 'KR',
      })
    ).toBe('서울특별시 역삼1동 강남대로 456');
  });

  it('도로 결과는 name을 도로명으로 사용', () => {
    expect(
      buildPhotonAddress({
        name: '서초대로',
        type: 'street',
        district: '역삼1동',
        city: '서울특별시',
        countrycode: 'KR',
      })
    ).toBe('서울특별시 역삼1동 서초대로');
  });

  it('프랑스: 번지 먼저, 쉼표 구분, 국가 포함', () => {
    expect(
      buildPhotonAddress({
        housenumber: '6',
        street: "Place de l'Hôtel de Ville",
        district: 'Le Marais',
        city: 'Paris',
        country: 'France',
        countrycode: 'FR',
      })
    ).toBe("6 Place de l'Hôtel de Ville, Paris, France");
  });

  it('독일: 도로명 뒤 번지, 중복 단위 제거', () => {
    expect(
      buildPhotonAddress({
        street: 'Unter den Linden',
        housenumber: '77',
        city: 'Berlin',
        state: 'Berlin',
        country: 'Deutschland',
        countrycode: 'DE',
      })
    ).toBe('Unter den Linden 77, Berlin, Deutschland');
  });

  it('도로가 없으면 동네 → 도시 → 국가', () => {
    expect(
      buildPhotonAddress({
        locality: '千住三丁目',
        city: '足立区',
        country: '日本',
        countrycode: 'JP',
      })
    ).toBe('千住三丁目, 足立区, 日本');
  });

  it('일본식 블록 번호는 동네명 + 번-호', () => {
    expect(
      buildPhotonAddress({
        street: '21',
        housenumber: '6',
        locality: '宇田川町',
        city: '渋谷区',
        country: '日本',
        countrycode: 'JP',
      })
    ).toBe('宇田川町 21-6, 渋谷区, 日本');
  });

  it('정보가 없으면 null', () => {
    expect(buildPhotonAddress({})).toBeNull();
  });
});

describe('reverseGeocode', () => {
  it('국내 + 카카오: 주소는 도로명, 주변 장소는 7개 업종 병렬 조회 후 거리순·중복 제거', async () => {
    const { fetchImpl, calls } = mockFetch((url) => {
      if (url.includes('coord2address')) {
        return {
          body: {
            documents: [
              {
                address: { address_name: '서울 강남구 역삼동 823' },
                road_address: { address_name: '서울 강남구 테헤란로 152' },
              },
            ],
          },
        };
      }
      const code = new URL(url).searchParams.get('category_group_code');
      if (code === 'CS2') return { body: { documents: [kakaoDoc({ id: 'a', distance: '30' })] } };
      if (code === 'CE7') {
        return {
          body: {
            documents: [
              kakaoDoc({
                id: 'b',
                place_name: '스타벅스',
                category_group_name: '카페',
                distance: '12',
              }),
              kakaoDoc({ id: 'a', distance: '30' }),
            ],
          },
        };
      }
      if (code === 'HP8') return Promise.reject(new TypeError('boom'));
      return { body: { documents: [] } };
    });

    const result = await reverseGeocode(37.5, 127.036, { kakaoKey: 'k', fetchImpl });
    expect(result.provider).toBe('kakao');
    expect(result.address).toBe('서울 강남구 테헤란로 152');
    expect(result.countryCode).toBe('KR');
    expect(result.places.map((p) => p.placeName)).toEqual(['스타벅스', 'GS25 역삼점']);
    expect(calls).toHaveLength(8);
    const categoryUrl = new URL(calls.find((c) => c.url.includes('category.json'))!.url);
    expect(categoryUrl.searchParams.get('radius')).toBe('60');
    expect(categoryUrl.searchParams.get('sort')).toBe('distance');
  });

  it('카카오 요청이 모두 실패하면 kakaoReverse는 throw → reverseGeocode는 Photon 폴백', async () => {
    const failing = mockFetch(() => ({ status: 401, body: {} }));
    await expect(
      kakaoReverse(37.5, 127, 'bad', { fetchImpl: failing.fetchImpl })
    ).rejects.toBeInstanceOf(LocationProviderError);

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchImpl } = mockFetch((url) =>
      url.includes('dapi.kakao.com')
        ? { status: 401, body: {} }
        : {
            body: {
              features: [
                photonFeature(
                  {
                    name: '서초대로',
                    type: 'street',
                    osm_key: 'highway',
                    city: '서울특별시',
                    countrycode: 'KR',
                  },
                  [127, 37.5]
                ),
              ],
            },
          }
    );
    const result = await reverseGeocode(37.5, 127, { kakaoKey: 'bad', fetchImpl });
    expect(result.provider).toBe('photon');
    expect(result.address).toBe('서울특별시 서초대로');
    expect(result.places).toEqual([]);
    spy.mockRestore();
  });

  it('해외 Photon: 소비 업종만 주변 장소로, 같은 이름은 하나만, 거리순, radius는 km', async () => {
    const f = (props: Record<string, unknown>, coords: [number, number]) =>
      photonFeature(
        { city: 'Paris', country: 'France', countrycode: 'FR', type: 'house', ...props },
        coords
      );
    const { fetchImpl, calls } = mockFetch(() => ({
      body: {
        features: [
          f(
            {
              osm_key: 'place',
              osm_value: 'house',
              housenumber: '8',
              street: "Place de l'Hôtel de Ville",
            },
            [2.35226, 48.85695]
          ),
          f(
            { osm_key: 'amenity', osm_value: 'townhall', name: 'Hôtel de Ville' },
            [2.35253, 48.85643]
          ),
          f(
            { osm_key: 'railway', osm_value: 'subway_entrance', name: 'Hôtel de Ville' },
            [2.35216, 48.85708]
          ),
          f({ osm_key: 'tourism', osm_value: 'artwork', name: 'La Science' }, [2.35187, 48.85665]),
          f({ osm_key: 'amenity', osm_value: 'cafe', name: 'Café Louis' }, [2.353, 48.857]),
          f({ osm_key: 'amenity', osm_value: 'cafe', name: 'Café Louis' }, [2.3531, 48.8571]),
          f({ osm_key: 'shop', osm_value: 'bakery', name: 'Boulangerie' }, [2.3523, 48.8567]),
          f(
            { osm_key: 'highway', osm_value: 'primary', type: 'street', name: 'Rue de Rivoli' },
            [2.3521, 48.8567]
          ),
        ],
      },
    }));

    const result = await photonReverse(48.8566, 2.3522, { fetchImpl });
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe('/reverse');
    expect(Number(url.searchParams.get('radius'))).toBeLessThan(1);
    expect(result.address).toBe("8 Place de l'Hôtel de Ville, Paris, France");
    expect(result.countryCode).toBe('FR');
    expect(result.places.map((p) => [p.placeName, p.category])).toEqual([
      ['Boulangerie', '베이커리'],
      ['Café Louis', '카페'],
    ]);
    expect(result.places[0].distance).toBeLessThanOrEqual(result.places[1].distance!);
  });
});
