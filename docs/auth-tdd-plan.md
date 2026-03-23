# Auth TDD Plan

## Scope
- Login / OAuth callback / middleware session guard

## Red (tests first)
1. callback route: external `next` 차단 테스트
2. middleware: unauthenticated protected route -> `/login` 리다이렉트
3. middleware: static assets are not redirected
4. login redirectTo: runtime origin 기반 안전 생성
5. session getUser 실패 시 500 방지

## Green
- 테스트 통과를 위한 최소 코드 수정만 수행

## Refactor
- 인증 유틸 단일화:
  - `buildRedirectTo()`
  - `sanitizeNextPath()`
  - `safeGetUser()`

## Gate
- auth 관련 변경 PR은 위 테스트 세트 통과가 머지 조건
