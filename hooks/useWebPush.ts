import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 서비스 워커 로드 타임아웃 헬퍼
const getReadyRegistration = async () => {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) => 
      setTimeout(() => reject(new Error('SW registration timeout')), 10000)
    )
  ]);
};

export function useWebPush() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const checkSubscription = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsLoading(false);
      return;
    }

    try {
      const registration = await getReadyRegistration();
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.warn('Subscription check failed or timed out:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 구독 상태 확인
  useEffect(() => {
    checkSubscription();
    // 4초 후 강제 로딩 종료 (안전장치)
    const timer = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) console.warn('Force stopping loading state');
        return false;
      });
    }, 4000);
    return () => clearTimeout(timer);
  }, [checkSubscription]);

  const subscribe = async () => {
    if (!VAPID_PUBLIC_KEY) {
      console.error('VAPID public key is missing');
      return false;
    }

    try {
      setIsLoading(true);
      const registration = await getReadyRegistration();
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // 서버에 구독 정보 저장
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription }),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription on server');
      }

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('Failed to subscribe:', error);
      alert(`알림 설정 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    try {
      setIsLoading(true);
      const registration = await getReadyRegistration();
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // 서버에서 구독 정보 삭제
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe
  };
}
