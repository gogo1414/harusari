import { render, screen, fireEvent } from '@testing-library/react';
import LocationPicker, { pickAutoLocation } from './LocationPicker';

describe('LocationPicker', () => {
  it('geolocation이 없는 환경에서도 에러 없이 "위치 추가"를 보여준다', () => {
    expect(navigator.geolocation).toBeUndefined();
    const onChange = jest.fn();
    render(<LocationPicker value={undefined} onChange={onChange} autoDetect />);

    expect(screen.getByRole('button', { name: /위치 추가/ })).toBeInTheDocument();
    expect(screen.queryByText('위치 확인 중…')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('값이 있으면 장소명과 주소, 삭제 버튼을 보여주고 삭제 시 null을 전달한다', () => {
    const onChange = jest.fn();
    render(
      <LocationPicker
        value={{
          placeName: 'GS25 역삼점',
          address: '서울 강남구 테헤란로 152',
          lat: 37.5,
          lng: 127.03,
          countryCode: 'KR',
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByText('GS25 역삼점')).toBeInTheDocument();
    expect(screen.getByText('서울 강남구 테헤란로 152')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '위치 삭제' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('장소명이 없으면 주소를 대신 보여준다', () => {
    render(
      <LocationPicker
        value={{
          placeName: null,
          address: 'Paris, France',
          lat: 48.85,
          lng: 2.35,
          countryCode: 'FR',
        }}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('Paris, France')).toBeInTheDocument();
  });
});

describe('pickAutoLocation', () => {
  const coords = { lat: 37.5, lng: 127.03, accuracy: 15 };
  const data = {
    address: '서울 강남구 테헤란로 152',
    countryCode: 'KR',
    provider: 'kakao' as const,
    places: [
      {
        placeName: '스타벅스',
        address: '서울 강남구 테헤란로 150',
        lat: 37.5001,
        lng: 127.0301,
        countryCode: 'KR',
        category: '카페',
        distance: 18,
      },
    ],
  };

  it('40m 이내 가장 가까운 장소를 고른다 (표시용 필드 제외)', () => {
    expect(pickAutoLocation(data, coords)).toEqual({
      placeName: '스타벅스',
      address: '서울 강남구 테헤란로 150',
      lat: 37.5001,
      lng: 127.0301,
      countryCode: 'KR',
    });
  });

  it('멀거나 GPS 오차가 크면 주소만', () => {
    const far = { ...data, places: [{ ...data.places[0], distance: 55 }] };
    expect(pickAutoLocation(far, coords)).toEqual({
      placeName: null,
      address: '서울 강남구 테헤란로 152',
      lat: 37.5,
      lng: 127.03,
      countryCode: 'KR',
    });
    expect(pickAutoLocation(data, { ...coords, accuracy: 500 }).placeName).toBeNull();
  });

  it('주소 조회 실패 시 좌표만', () => {
    expect(pickAutoLocation(null, coords)).toEqual({
      placeName: null,
      address: null,
      lat: 37.5,
      lng: 127.03,
      countryCode: null,
    });
  });
});
