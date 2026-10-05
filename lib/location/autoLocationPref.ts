/**
 * 새 내역 입력 시 현재 위치 자동 추가 설정 (기기별 localStorage).
 * 기본값은 꺼짐(수동 선택). 사용자가 켠 경우('on')에만 자동으로 채운다.
 */
export const AUTO_LOCATION_PREF_KEY = 'harusari:auto-location';

export function readAutoLocationPref(): boolean {
  try {
    return window.localStorage.getItem(AUTO_LOCATION_PREF_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeAutoLocationPref(on: boolean) {
  try {
    window.localStorage.setItem(AUTO_LOCATION_PREF_KEY, on ? 'on' : 'off');
  } catch {
    // 사생활 보호 모드 등 저장 불가 → 이번 화면에서만 반영
  }
}
