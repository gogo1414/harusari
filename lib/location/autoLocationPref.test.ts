import { AUTO_LOCATION_PREF_KEY, readAutoLocationPref, writeAutoLocationPref } from './autoLocationPref';

describe('autoLocationPref', () => {
  beforeEach(() => window.localStorage.clear());

  it('저장된 값이 없으면 꺼짐(수동 선택)', () => {
    expect(readAutoLocationPref()).toBe(false);
  });

  it('켜고 끈 값을 그대로 읽는다', () => {
    writeAutoLocationPref(true);
    expect(window.localStorage.getItem(AUTO_LOCATION_PREF_KEY)).toBe('on');
    expect(readAutoLocationPref()).toBe(true);
    writeAutoLocationPref(false);
    expect(readAutoLocationPref()).toBe(false);
  });
});
