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
     */
    '/((?!_next/static|_next/image|favicon.ico|icons|auth|api/push|api/cron).*)',
  ],
};
