import { sanitizeNextPath } from './auth';

describe('sanitizeNextPath', () => {
  it('정상적인 내부 경로는 그대로 통과', () => {
    expect(sanitizeNextPath('/stats')).toBe('/stats');
    expect(sanitizeNextPath('/recurring/new?type=expense')).toBe('/recurring/new?type=expense');
  });

  it('null/undefined/빈 값은 "/"', () => {
    expect(sanitizeNextPath(null)).toBe('/');
    expect(sanitizeNextPath(undefined)).toBe('/');
    expect(sanitizeNextPath('')).toBe('/');
  });

  it('절대 URL은 차단', () => {
    expect(sanitizeNextPath('https://evil.com')).toBe('/');
    expect(sanitizeNextPath('http://evil.com')).toBe('/');
  });

  it('protocol-relative URL은 차단 (open redirect 방지)', () => {
    expect(sanitizeNextPath('//evil.com')).toBe('/');
    expect(sanitizeNextPath('/\\evil.com')).toBe('/');
  });

  it("'/'로 시작하지 않는 값은 차단", () => {
    expect(sanitizeNextPath('evil.com')).toBe('/');
    expect(sanitizeNextPath('javascript:alert(1)')).toBe('/');
  });
});
