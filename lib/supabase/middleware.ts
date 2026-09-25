import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 일시적인 인증 서버/네트워크 장애 여부.
 * 이 경우 세션이 '없다'고 단정할 수 없으므로 로그인 페이지로 보내지 않는다.
 */
function isTransientAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, status } = error as { name?: string; status?: number };
  if (name === 'AuthRetryableFetchError') return true;
  if (typeof status === 'number' && (status === 0 || status >= 500)) return true;
  return false;
}

/**
 * getUser()가 갱신(rotate)한 세션 쿠키를 리다이렉트 응답에도 옮겨 담는다.
 * 누락하면 갱신된 refresh token이 브라우저에 전달되지 않아 세션이 끊길 수 있다.
 */
function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
  const response = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 중요: getUser를 호출하여 세션을 갱신해야 합니다.
  let user = null;
  // 인증 서버 장애/네트워크 오류로 세션 유무를 판단할 수 없는 상태
  let authUnavailable = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    if (!user && isTransientAuthError(error)) {
      authUnavailable = true;
      console.error('Middleware getUser transient error:', error);
    }
  } catch (error) {
    // 예외(네트워크 장애 등)도 세션이 없다고 단정할 수 없으므로 통과시킨다 (클라이언트가 처리)
    authUnavailable = true;
    console.error('Middleware getUser threw:', error);
  }

  if (authUnavailable) {
    return supabaseResponse;
  }

  // 로그인되지 않은 사용자가 보호된 라우트에 접근하면 로그인 페이지로 리다이렉트
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return redirectWithCookies(url, supabaseResponse);
  }

  // 로그인된 사용자가 로그인 페이지에 접근하면 메인으로 리다이렉트
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return redirectWithCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}
