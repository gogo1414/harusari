/**
 * OAuth 콜백 등에서 받은 `next` 경로를 안전한 내부 경로로 정규화한다.
 *
 * open redirect 방지:
 * - 반드시 '/'로 시작하는 상대 경로만 허용
 * - protocol-relative URL('//evil.com', '/\evil.com')은 차단
 *   (new URL('//evil.com', origin) === https://evil.com 이 되어 피싱에 악용 가능)
 *
 * @param rawNext 쿼리 파라미터로 받은 원본 next 값
 * @returns 안전한 내부 경로 (검증 실패 시 '/')
 */
export function sanitizeNextPath(rawNext: string | null | undefined): string {
  const fallback = '/';
  if (!rawNext) return fallback;
  if (!rawNext.startsWith('/')) return fallback;
  // '//' 또는 '/\' 로 시작하면 protocol-relative URL이므로 차단
  if (rawNext.startsWith('//') || rawNext.startsWith('/\\')) return fallback;
  return rawNext;
}
