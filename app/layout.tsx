import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '하루살이',
  description: '오늘 벌어 오늘 사는 1인 가계부',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    shortcut: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '하루살이',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3182F6' },
    { media: '(prefers-color-scheme: dark)', color: '#1e3a5f' },
  ],
};

import Providers from './providers';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          {/* 모바일 중앙 정렬 컨테이너 */}
          <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-background shadow-sm">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
