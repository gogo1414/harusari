/**
 * 차트 팔레트의 실제 색상값 (app/globals.css의 --viz-* 토큰과 동일하게 유지).
 * CSS 변수를 해석할 수 없는 곳(Leaflet 캔버스 렌더러)에서만 사용한다.
 */
export type VizTheme = 'light' | 'dark';

export const VIZ_CATEGORY_HEX: Record<VizTheme, readonly string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'],
};

export const VIZ_OTHER_HEX: Record<VizTheme, string> = { light: '#b4b2aa', dark: '#5f5e5a' };

/** 카드 표면 (마커 링 = surface ring) */
export const VIZ_SURFACE_HEX: Record<VizTheme, string> = { light: '#ffffff', dark: '#17171c' };

/** 선택 강조 링 */
export const VIZ_INK_HEX: Record<VizTheme, string> = { light: '#191f28', dark: '#ffffff' };

/** 슬롯 → 실제 색 (지도는 maxSlots 이후를 기타색으로) */
export function slotHex(slot: number | null | undefined, theme: VizTheme, maxSlots: number): string {
  if (slot === null || slot === undefined || slot < 0 || slot >= maxSlots) return VIZ_OTHER_HEX[theme];
  return VIZ_CATEGORY_HEX[theme][slot] ?? VIZ_OTHER_HEX[theme];
}
