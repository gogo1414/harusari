import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icons (PWA icons)
     * - auth (auth callback routes)
     * - api/push (push notification API)
     * - api/cron (cron job API)
     * - PWA 자산: 서비스 워커(sw.js, custom-sw.js, workbox-*, swe-worker-*, fallback-*, worker-*),
     *   매니페스트, 오프라인 fallback 페이지(/offline, /~offline)
     *   (서비스 워커 설치/precache 요청이 /login으로 리다이렉트되면 잘못된 응답이 캐시된다)
     */
    '/((?!_next/static|_next/image|favicon.ico|icons|auth|api/push|api/cron|manifest.json|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|custom-sw\\.js|workbox-.*|swe-worker-.*|fallback-.*|worker-.*|offline|~offline).*)',
  ],
};
