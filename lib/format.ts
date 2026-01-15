/**
 * 통화 포맷팅 (한국어)
 * @param amount 금액
 * @returns 포맷된 금액 문자열
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

/**
 * 금액 축약 표시 (만/천 단위)
 * @param value 금액
 * @returns 축약된 문자열
 */
export function formatCompactCurrency(value: number): string {
  if (isNaN(value) || value === 0) return '';
  if (value >= 10000) return `${(value / 10000).toFixed(1)}만`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}천`;
  return formatCurrency(value);
}
