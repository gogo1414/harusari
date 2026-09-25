import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// Supabase(REST/Auth/Storage/Realtime) 응답은 사용자별 금융 데이터이므로 절대 캐시하지 않는다.
// 기본 runtimeCaching의 cross-origin NetworkFirst 규칙에 걸리면 오프라인/네트워크 지연 시
// Cache Storage의 오래된(또는 이전 로그인 사용자의) 데이터가 응답될 수 있다.
// 커스텀 도메인을 쓰는 경우를 대비해 NEXT_PUBLIC_SUPABASE_URL의 origin도 함께 제외한다.
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : null;
  } catch {
    return null;
  }
})();

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  // 오프라인 시 문서 요청 fallback (브라우저 기본 에러 화면 대신 /offline 표시)
  fallbacks: {
    document: "/offline",
  },
  // 아래 runtimeCaching을 기본 규칙 앞에 추가한다 (workbox는 먼저 등록된 규칙이 우선).
  // 같은 cacheName("apis")을 가진 기본 규칙은 이 설정으로 대체된다.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    importScripts: ["/custom-sw.js"],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/[^/]+\.supabase\.co\/.*/i,
        handler: "NetworkOnly",
      },
      ...(supabaseOrigin
        ? [
            {
              urlPattern: new RegExp(`^${escapeRegExp(supabaseOrigin)}/.*`, "i"),
              handler: "NetworkOnly" as const,
            },
          ]
        : []),
      {
        // 동일 출처 /api/* (푸시 구독, 고정 거래 동기화 등): 사용자별 응답이므로 캐시 금지.
        // cacheName을 기본 규칙("apis", NetworkFirst)과 맞춰 기본 규칙을 대체한다.
        urlPattern: ({ sameOrigin, url: { pathname } }) =>
          sameOrigin && pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: {
          cacheName: "apis",
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA(nextConfig);
