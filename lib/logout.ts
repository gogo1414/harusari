/**
 * 서비스 워커 Cache Storage를 비운다 (best-effort).
 * 로그아웃 후 다른 사용자가 같은 기기에서 로그인했을 때 이전 사용자의 페이지/데이터가
 * 캐시에서 응답되지 않도록 한다. 실패해도 로그아웃 흐름은 계속 진행한다.
 */
export async function clearClientCaches(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}
