import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

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
  workboxOptions: {
    disableDevLogs: true,
    importScripts: ["/custom-sw.js"],
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  /* config options here */
};

export default withPWA(nextConfig);
