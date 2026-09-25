'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type GeolocationStatus =
  | 'idle'
  | 'locating'
  | 'success'
  | 'denied'
  | 'unavailable'
  | 'error';
export type GeolocationPermission = PermissionState | 'unknown';

export interface GeoCoords {
  lat: number;
  lng: number;
  /** 정확도 반경(m) */
  accuracy: number | null;
}

const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 60000,
};

export interface GeolocationResult {
  status: GeolocationStatus;
  coords: GeoCoords | null;
}

const noopSubscribe = () => () => {};

export function hasGeolocation(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
}

/** Permissions API로 위치 권한 상태 조회 (미지원 브라우저는 'unknown') */
export async function queryGeolocationPermission(): Promise<GeolocationPermission> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return 'unknown';
  }
}

/**
 * navigator.geolocation 래퍼 (SSR 안전).
 * - request(): 현재 위치를 한 번 조회해 { status, coords }를 돌려준다 (실패 시 coords null)
 * - permission: Permissions API 상태. 'denied'면 request()는 권한 창을 띄우지 않고 바로 denied 처리
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [permission, setPermission] = useState<GeolocationPermission>('unknown');
  const isSupported = useSyncExternalStore(noopSubscribe, hasGeolocation, () => false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (status && mountedRef.current) setPermission(status.state);
    };
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (!mountedRef.current) return;
          status = result;
          setPermission(result.state);
          result.addEventListener?.('change', onChange);
        })
        .catch(() => {
          // Safari 일부 버전 등 geolocation 조회 미지원 → unknown 유지
        });
    }
    return () => {
      mountedRef.current = false;
      status?.removeEventListener?.('change', onChange);
    };
  }, []);

  const request = useCallback(async (): Promise<GeolocationResult> => {
    if (!hasGeolocation()) {
      setStatus('unavailable');
      return { status: 'unavailable', coords: null };
    }
    const perm = await queryGeolocationPermission();
    if (perm !== 'unknown' && mountedRef.current) setPermission(perm);
    if (perm === 'denied') {
      if (mountedRef.current) setStatus('denied');
      return { status: 'denied', coords: null };
    }

    if (mountedRef.current) setStatus('locating');
    return new Promise<GeolocationResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next: GeoCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          };
          if (mountedRef.current) {
            setCoords(next);
            setStatus('success');
          }
          resolve({ status: 'success', coords: next });
        },
        (error) => {
          const next: GeolocationStatus =
            error.code === error.PERMISSION_DENIED
              ? 'denied'
              : error.code === error.POSITION_UNAVAILABLE
                ? 'unavailable'
                : 'error';
          if (mountedRef.current) {
            setStatus(next);
            if (next === 'denied') setPermission('denied');
          }
          resolve({ status: next, coords: null });
        },
        POSITION_OPTIONS
      );
    });
  }, []);

  return { status, coords, permission, isSupported, request };
}
