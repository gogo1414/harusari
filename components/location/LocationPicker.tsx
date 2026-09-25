'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { Check, Loader2, MapPin, MapPinOff, Navigation, RotateCw, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import {
  hasGeolocation,
  queryGeolocationPermission,
  useGeolocation,
  type GeoCoords,
} from '@/hooks/useGeolocation';
import type { TransactionLocation } from '@/lib/location/types';
import {
  formatDistance,
  toTransactionLocation,
  type LocationProviderName,
  type PlaceResult,
  type PlaceSearchResponse,
  type ReverseGeocodeResponse,
} from '@/lib/location/place';

/** 자동 위치 추가 사용자 설정 (localStorage, 'off'면 끔) */
export const AUTO_LOCATION_PREF_KEY = 'harusari:auto-location';
/** 이 거리(m) 안의 가장 가까운 장소를 자동 선택 */
const AUTO_PLACE_MAX_DISTANCE_M = 40;
/** GPS 오차가 이보다 크면 장소 대신 주소만 자동 선택 */
const AUTO_PLACE_MAX_ACCURACY_M = 100;
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_LENGTH = 2;
const SEARCH_MAX_LENGTH = 60;
const DENIED_MESSAGE = '위치 권한이 꺼져 있어요. 장소를 검색해 추가할 수 있어요';
const FETCH_ERROR_MESSAGE = '장소 정보를 불러오지 못했어요';

export function readAutoLocationPref(): boolean {
  try {
    return window.localStorage.getItem(AUTO_LOCATION_PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeAutoLocationPref(on: boolean) {
  try {
    window.localStorage.setItem(AUTO_LOCATION_PREF_KEY, on ? 'on' : 'off');
  } catch {
    // 사생활 보호 모드 등 저장 불가 → 이번 화면에서만 반영
  }
}

/** 같은 출처 API 호출. 비로그인 리다이렉트(HTML) 등 JSON이 아닌 응답도 에러로 처리 */
async function fetchLocationApi<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, credentials: 'same-origin' });
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  if (!res.ok || !isJson) {
    let message = FETCH_ERROR_MESSAGE;
    if (isJson) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) message = body.error;
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** 자동 감지 결과 → 저장할 위치 (가까운 장소가 있으면 장소, 없으면 주소만) */
export function pickAutoLocation(
  data: ReverseGeocodeResponse | null,
  coords: GeoCoords
): TransactionLocation {
  const nearest = data?.places[0];
  const accurate = coords.accuracy === null || coords.accuracy <= AUTO_PLACE_MAX_ACCURACY_M;
  if (
    nearest &&
    accurate &&
    typeof nearest.distance === 'number' &&
    nearest.distance <= AUTO_PLACE_MAX_DISTANCE_M
  ) {
    return toTransactionLocation(nearest);
  }
  return addressOnly(data, coords);
}

function addressOnly(data: ReverseGeocodeResponse | null, coords: GeoCoords): TransactionLocation {
  return {
    placeName: null,
    address: data?.address ?? null,
    lat: coords.lat,
    lng: coords.lng,
    countryCode: data?.countryCode ?? null,
  };
}

function locationLabel(loc: TransactionLocation): string {
  return loc.placeName || loc.address || '현재 위치';
}

function isSameLocation(a: TransactionLocation | null | undefined, b: TransactionLocation) {
  return (
    !!a &&
    a.placeName === b.placeName &&
    Math.abs(a.lat - b.lat) < 1e-6 &&
    Math.abs(a.lng - b.lng) < 1e-6
  );
}

type NearbyState = {
  status: 'idle' | 'loading' | 'success' | 'denied' | 'unavailable' | 'error';
  data: ReverseGeocodeResponse | null;
  coords: GeoCoords | null;
};

type SearchState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  results: PlaceResult[];
  provider: LocationProviderName | null;
  message?: string;
};

const IDLE_SEARCH: SearchState = { status: 'idle', results: [], provider: null };

interface LocationPickerProps {
  value: TransactionLocation | null | undefined;
  onChange: (loc: TransactionLocation | null) => void;
  /** 마운트 시 값이 없으면 현재 위치를 자동으로 채운다 (신규 입력용) */
  autoDetect?: boolean;
  className?: string;
}

/**
 * 거래 위치 선택.
 * 폼에는 한 줄짜리 칩으로 표시되고, 누르면 바텀시트에서 주변 장소/검색/주소만/위치 없음을 고른다.
 */
export default function LocationPicker({
  value,
  onChange,
  autoDetect = false,
  className,
}: LocationPickerProps) {
  const { request, coords: gpsCoords } = useGeolocation();
  const [open, setOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [nearby, setNearby] = useState<NearbyState>({ status: 'idle', data: null, coords: null });
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>(IDLE_SEARCH);
  const [autoPref, setAutoPref] = useState(readAutoLocationPref);
  const labelId = useId();
  const prefId = useId();

  // 비동기 콜백에서 최신 props를 읽기 위한 ref
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  /** 사용자가 직접 고르거나 지웠으면 자동 감지 결과로 덮어쓰지 않는다 */
  const userTouchedRef = useRef(false);
  const nearbyAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      nearbyAbortRef.current?.abort();
      searchAbortRef.current?.abort();
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  /** 현재 위치 → 주소 + 주변 장소 조회 */
  const loadNearby = useCallback(async () => {
    nearbyAbortRef.current?.abort();
    const controller = new AbortController();
    nearbyAbortRef.current = controller;
    setNearby({ status: 'loading', data: null, coords: null });

    const geo = await request();
    if (controller.signal.aborted) return null;
    if (!geo.coords) {
      const status =
        geo.status === 'denied' ? 'denied' : geo.status === 'unavailable' ? 'unavailable' : 'error';
      setNearby({ status, data: null, coords: null });
      return null;
    }

    const coords = geo.coords;
    try {
      const params = new URLSearchParams({ lat: String(coords.lat), lng: String(coords.lng) });
      const data = await fetchLocationApi<ReverseGeocodeResponse>(
        `/api/location/reverse?${params.toString()}`,
        controller.signal
      );
      if (controller.signal.aborted) return null;
      setNearby({ status: 'success', data, coords });
      return { data, coords };
    } catch {
      if (controller.signal.aborted) return null;
      // 주소 조회는 실패해도 좌표는 남겨 '현재 위치 사용'이 가능하게 한다
      setNearby({ status: 'error', data: null, coords });
      return { data: null, coords };
    }
  }, [request]);

  // 신규 입력: 마운트 시 1회 현재 위치 자동 추가
  useEffect(() => {
    if (!autoDetect || valueRef.current !== undefined) return;
    if (!hasGeolocation() || !readAutoLocationPref()) return;
    let cancelled = false;

    (async () => {
      // 권한이 꺼져 있으면 권한 창을 다시 띄우지 않는다
      const permission = await queryGeolocationPermission();
      if (cancelled || permission === 'denied') return;
      setDetecting(true);
      const result = await loadNearby();
      if (cancelled) return;
      setDetecting(false);
      if (!result || userTouchedRef.current || valueRef.current !== undefined) return;
      onChangeRef.current(pickAutoLocation(result.data, result.coords));
    })();

    return () => {
      cancelled = true;
    };
    // 마운트 시 1회만 실행 (autoDetect 변경에 반응하지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      if (nearby.status === 'idle') {
        if (hasGeolocation()) void loadNearby();
        else setNearby({ status: 'unavailable', data: null, coords: null });
      }
    } else {
      // 닫을 때 검색 초기화
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchAbortRef.current?.abort();
      setQuery('');
      setSearch(IDLE_SEARCH);
    }
  };

  const select = (loc: TransactionLocation | null) => {
    userTouchedRef.current = true;
    onChange(loc);
    handleOpenChange(false);
  };

  const runSearch = async (q: string) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    const params = new URLSearchParams({ q });
    // 가까운 곳 우선: GPS 좌표 → 없으면 현재 선택된 위치
    const bias = nearby.coords ?? gpsCoords ?? value ?? null;
    if (bias) {
      params.set('lat', String(bias.lat));
      params.set('lng', String(bias.lng));
    }
    try {
      const data = await fetchLocationApi<PlaceSearchResponse>(
        `/api/location/search?${params.toString()}`,
        controller.signal
      );
      if (controller.signal.aborted) return;
      setSearch({ status: 'success', results: data.results, provider: data.provider });
    } catch (error) {
      if (controller.signal.aborted) return;
      setSearch({
        status: 'error',
        results: [],
        provider: null,
        message: error instanceof Error ? error.message : FETCH_ERROR_MESSAGE,
      });
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.slice(0, SEARCH_MAX_LENGTH);
    setQuery(next);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchAbortRef.current?.abort();

    const trimmed = next.trim();
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setSearch(IDLE_SEARCH);
      return;
    }
    setSearch((prev) => ({ ...prev, status: 'loading' }));
    searchTimerRef.current = setTimeout(() => void runSearch(trimmed), SEARCH_DEBOUNCE_MS);
  };

  const handleUseCurrentAddress = async () => {
    if (nearby.coords) {
      select(addressOnly(nearby.data, nearby.coords));
      return;
    }
    const result = await loadNearby();
    if (result) {
      select(addressOnly(result.data, result.coords));
    } else if (!hasGeolocation()) {
      showToast.error('이 기기에서는 현재 위치를 확인할 수 없어요');
    }
  };

  const handleAutoPrefChange = (checked: boolean) => {
    setAutoPref(checked);
    writeAutoLocationPref(checked);
  };

  const showingSearch = query.trim().length >= SEARCH_MIN_LENGTH;
  const provider = showingSearch ? search.provider : (nearby.data?.provider ?? null);
  const currentAddress = nearby.data?.address ?? null;

  // ───────── 폼 안의 칩 ─────────
  const primaryText =
    detecting && !value ? '위치 확인 중…' : value ? locationLabel(value) : '위치 추가';
  const secondaryText = value && value.placeName && value.address ? value.address : null;

  return (
    <div className={className}>
      <span id={labelId} className="text-[13px] font-bold text-muted-foreground ml-1 mb-2 block">
        위치
      </span>
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => handleOpenChange(true)}
          aria-describedby={labelId}
          aria-haspopup="dialog"
          className={cn(
            'flex min-h-14 w-full items-center gap-3 rounded-2xl bg-muted/30 px-5 py-3 text-left transition-all',
            'hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
            value && 'pr-14'
          )}
        >
          {detecting && !value ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <MapPin
              className={cn('h-5 w-5 shrink-0', value ? 'text-primary' : 'text-muted-foreground')}
              aria-hidden
            />
          )}
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-[15px]',
                value ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
              )}
            >
              {primaryText}
            </span>
            {secondaryText && (
              <span className="block truncate text-xs text-muted-foreground">{secondaryText}</span>
            )}
          </span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              userTouchedRef.current = true;
              onChange(null);
            }}
            aria-label="위치 삭제"
            className="absolute right-1.5 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:opacity-70"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* ───────── 바텀시트 ───────── */}
      <Drawer.Root open={open} onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[88dvh] max-w-[480px] flex-col rounded-t-[32px] bg-card outline-none shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
            <div className="flex justify-center py-4">
              <div className="h-1.5 w-16 rounded-full bg-muted-foreground/20" />
            </div>

            <div className="px-5 pb-3">
              <div className="mb-4 flex items-center justify-between">
                <Drawer.Title className="text-xl font-bold tracking-tight text-foreground">
                  위치 선택
                </Drawer.Title>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  aria-label="닫기"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <Drawer.Description className="sr-only">
                주변 장소를 고르거나 장소를 검색해 이 내역의 위치로 기록합니다
              </Drawer.Description>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  value={query}
                  onChange={handleQueryChange}
                  placeholder="장소나 주소 검색"
                  aria-label="장소 검색"
                  maxLength={SEARCH_MAX_LENGTH}
                  className="h-12 rounded-2xl border-none bg-muted/50 pl-12 text-base focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] hide-scrollbar">
              {showingSearch ? (
                <section aria-label="검색 결과" aria-busy={search.status === 'loading'}>
                  <SectionTitle>검색 결과</SectionTitle>
                  {search.status === 'loading' && search.results.length === 0 && (
                    <LoadingRow text="검색 중…" />
                  )}
                  {search.status === 'error' && (
                    <MessageRow text={search.message ?? FETCH_ERROR_MESSAGE} />
                  )}
                  {search.status === 'success' && search.results.length === 0 && (
                    <MessageRow text="검색 결과가 없어요. 다른 이름으로 검색해 보세요" />
                  )}
                  {search.results.length > 0 && (
                    <PlaceList
                      places={search.results}
                      value={value}
                      onSelect={(p) => select(toTransactionLocation(p))}
                      dimmed={search.status === 'loading'}
                    />
                  )}
                </section>
              ) : (
                <section aria-label="주변 장소" aria-busy={nearby.status === 'loading'}>
                  <SectionTitle>주변 장소</SectionTitle>
                  {nearby.status === 'loading' && (
                    <LoadingRow text="현재 위치를 확인하고 있어요…" />
                  )}
                  {nearby.status === 'denied' && <MessageRow text={DENIED_MESSAGE} />}
                  {(nearby.status === 'unavailable' || nearby.status === 'error') && (
                    <MessageRow
                      text={
                        nearby.status === 'unavailable'
                          ? '현재 위치를 확인할 수 없어요. 장소를 검색해 추가할 수 있어요'
                          : nearby.coords
                            ? '주변 장소를 불러오지 못했어요'
                            : '현재 위치를 확인하지 못했어요'
                      }
                      onRetry={hasGeolocation() ? () => void loadNearby() : undefined}
                    />
                  )}
                  {nearby.status === 'success' &&
                    nearby.data &&
                    nearby.data.places.length === 0 && (
                      <MessageRow text="주변에서 찾은 장소가 없어요. 검색해 보세요" />
                    )}
                  {nearby.data && nearby.data.places.length > 0 && (
                    <PlaceList
                      places={nearby.data.places}
                      value={value}
                      onSelect={(p) => select(toTransactionLocation(p))}
                    />
                  )}
                </section>
              )}

              <div className="mt-3 space-y-1 border-t border-border/60 pt-3">
                <ActionRow
                  icon={<Navigation className="h-5 w-5" aria-hidden />}
                  title="현재 위치(주소만) 사용"
                  subtitle={currentAddress}
                  disabled={
                    nearby.status === 'loading' ||
                    nearby.status === 'denied' ||
                    nearby.status === 'unavailable'
                  }
                  onClick={() => void handleUseCurrentAddress()}
                />
                <ActionRow
                  icon={<MapPinOff className="h-5 w-5" aria-hidden />}
                  title="위치 없음"
                  selected={value === null}
                  onClick={() => select(null)}
                />
              </div>

              <div className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3">
                <label htmlFor={prefId} className="text-sm font-medium text-foreground">
                  입력할 때 현재 위치 자동 추가
                </label>
                <Switch id={prefId} checked={autoPref} onCheckedChange={handleAutoPrefChange} />
              </div>

              {provider && (
                <p className="mt-3 px-2 text-[11px] text-muted-foreground/80">
                  장소 데이터 © {provider === 'kakao' ? 'Kakao' : 'OpenStreetMap contributors'}
                </p>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

// ─────────────────────────────── 하위 요소 ───────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="px-2 pb-1 pt-1 text-[13px] font-bold text-muted-foreground">{children}</h3>;
}

function LoadingRow({ text }: { text: string }) {
  return (
    <div
      className="flex min-h-14 items-center gap-3 px-3 text-sm text-muted-foreground"
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {text}
    </div>
  );
}

function MessageRow({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2 text-sm text-muted-foreground">
      <p role="status">{text}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 font-medium text-primary hover:bg-primary/10"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
          다시 시도
        </button>
      )}
    </div>
  );
}

function PlaceList({
  places,
  value,
  onSelect,
  dimmed = false,
}: {
  places: PlaceResult[];
  value: TransactionLocation | null | undefined;
  onSelect: (place: PlaceResult) => void;
  dimmed?: boolean;
}) {
  return (
    <ul className={cn('space-y-0.5 transition-opacity', dimmed && 'opacity-60')}>
      {places.map((place, index) => {
        const name = place.placeName || place.address || '이름 없는 장소';
        const address = place.placeName ? place.address : null;
        const distance = formatDistance(place.distance);
        const selected = isSameLocation(value, place);
        return (
          <li key={`${place.placeName ?? ''}-${place.lat}-${place.lng}-${index}`}>
            <button
              type="button"
              onClick={() => onSelect(place)}
              aria-pressed={selected}
              className={cn(
                'flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
                'hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
                selected && 'bg-primary/5'
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-[15px] font-semibold text-foreground">{name}</span>
                  {place.category && (
                    <span className="shrink-0 text-xs text-muted-foreground">{place.category}</span>
                  )}
                </span>
                {address && (
                  <span className="block truncate text-xs text-muted-foreground">{address}</span>
                )}
              </span>
              {distance && (
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {distance}
                </span>
              )}
              {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  selected = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string | null;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
        'hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
        'disabled:pointer-events-none disabled:opacity-50'
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-foreground">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </span>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
    </button>
  );
}
