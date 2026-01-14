'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (provider: 'google' | 'kakao') => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error('Login error:', error);
      alert('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <div className="mb-12 text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary text-5xl">
          💸
        </div>
        <h1 className="mb-2 text-2xl font-bold">하루살이</h1>
        <p className="text-muted-foreground">오늘 벌어 오늘 사는<br />가장 심플한 1인 가계부</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {/* 구글 로그인 */}
        <Button
          className="h-12 w-full justify-start gap-3 bg-white text-black shadow-sm hover:bg-gray-50 border border-gray-200"
          onClick={() => handleLogin('google')}
          disabled={isLoading}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google로 계속하기
        </Button>

        {/* 카카오 로그인 */}
        <Button
          className="h-12 w-full justify-start gap-3 bg-[#FEE500] text-black hover:bg-[#FEE500]/90"
          onClick={() => handleLogin('kakao')}
          disabled={isLoading}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C5.9 3 1 6.9 1 11.8c0 2.8 1.8 5.3 4.6 6.9l-.8 3c-.1.4.3.7.6.5l3.5-2.3c1 .3 2 .4 3.1.4 6.1 0 11-3.9 11-8.8C23 6.9 18.1 3 12 3z" />
          </svg>
          카카오로 계속하기
        </Button>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        로그인 시 이용약관 및 개인정보처리방침에 동의하게 됩니다.
      </p>
    </div>
  );
}
