import { formatCurrency, formatCompactCurrency } from './format';

describe('formatCurrency', () => {
  it('천 단위 콤마로 포맷한다', () => {
    expect(formatCurrency(1000000)).toBe('1,000,000');
  });

  it('1000 미만은 콤마 없이 반환한다', () => {
    expect(formatCurrency(500)).toBe('500');
  });

  it('0은 "0"으로 반환한다', () => {
    expect(formatCurrency(0)).toBe('0');
  });

  it('음수도 포맷한다', () => {
    expect(formatCurrency(-50000)).toBe('-50,000');
  });
});

describe('formatCompactCurrency', () => {
  it('0이면 빈 문자열을 반환한다', () => {
    expect(formatCompactCurrency(0)).toBe('');
  });

  it('NaN이면 빈 문자열을 반환한다', () => {
    expect(formatCompactCurrency(NaN)).toBe('');
  });

  it('10000 이상이면 만 단위로 표시한다', () => {
    expect(formatCompactCurrency(10000)).toBe('1.0만');
    expect(formatCompactCurrency(50000)).toBe('5.0만');
    expect(formatCompactCurrency(123456)).toBe('12.3만');
  });

  it('1000 이상 10000 미만이면 천 단위로 표시한다', () => {
    expect(formatCompactCurrency(1000)).toBe('1.0천');
    expect(formatCompactCurrency(5500)).toBe('5.5천');
    expect(formatCompactCurrency(9999)).toBe('10.0천');
  });

  it('1000 미만이면 일반 통화 포맷으로 표시한다', () => {
    expect(formatCompactCurrency(999)).toBe('999');
    expect(formatCompactCurrency(500)).toBe('500');
  });
});
