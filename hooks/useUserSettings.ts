'use client';

/**
 * @deprecated 이 훅은 app/context/UserSettingsContext 로 통합되었습니다.
 * 별도 queryKey/반환 형태로 이중 페칭·중복 로직을 유발하던 구현을 제거하고
 * 컨텍스트 단일 소스를 재노출합니다. 신규 코드는 아래에서 직접 import 하세요.
 *
 *   import { useUserSettings } from '@/app/context/UserSettingsContext';
 */
export { useUserSettings } from '@/app/context/UserSettingsContext';
