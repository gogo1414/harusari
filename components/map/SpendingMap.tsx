'use client';

/**
 * 지출 장소 지도 (Leaflet). 브라우저 전용 — 반드시 SpendingMapLazy(next/dynamic, ssr:false)로 불러온다.
 * - 원 크기: 장소 총액의 제곱근 비례 (면적이 금액에 비례)
 * - 원 색: 장소의 대표 카테고리 (지도는 모든 쌍 비교 형태라 상위 3개 카테고리만 색, 나머지는 회색)
 * - 캔버스 렌더러 + tolerance로 작은 원도 손가락으로 누르기 쉽게 (최소 약 28px 히트 영역)
 */
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { AttributionControl, CircleMarker, MapContainer, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import { MapPinOff } from 'lucide-react';
import type { GeoBounds, SpendingPlace } from '@/lib/stats/places';
import { VIZ_INK_HEX, VIZ_SURFACE_HEX, slotHex, type VizTheme } from '@/lib/stats/palette';
import { MAP_SLOT_COUNT, formatWon } from '@/lib/stats/series';
import { cn } from '@/lib/utils';

export interface SpendingMapPlace extends SpendingPlace {
  /** 대표 카테고리의 색 슬롯 (없으면 기타색) */
  colorSlot: number | null;
  /** 대표 카테고리 이름 (툴팁용) */
  categoryName: string | null;
}

export interface SpendingMapProps {
  places: SpendingMapPlace[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  /** 이 범위로 화면 맞춤. fitKey가 바뀔 때마다 다시 맞춘다 */
  fitBounds: GeoBounds | null;
  fitKey: string;
  theme: VizTheme;
  /** 스크린리더용 지도 설명 */
  ariaLabel: string;
}

/**
 * 배경 지도 타일.
 * CARTO basemaps(light_all/dark_all)는 2026년 현재 키 없이 요청하면 'API KEY REQUIRED' 워터마크 타일을 준다.
 * 그래서 기본값은 키가 필요 없는 OpenStreetMap 표준 타일(전 세계, 현지어 라벨)을 쓰고,
 * CSS 필터로 채도를 낮춰(다크 모드는 반전) 데이터 점이 돋보이게 한다.
 * 키가 있는 제공자(CARTO 등)를 쓰려면 아래 환경 변수로 URL 템플릿을 지정한다. 지정 시 필터는 끈다.
 *   NEXT_PUBLIC_MAP_TILE_URL_LIGHT / NEXT_PUBLIC_MAP_TILE_URL_DARK / NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
 */
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

const CUSTOM_LIGHT = process.env.NEXT_PUBLIC_MAP_TILE_URL_LIGHT;
const CUSTOM_DARK = process.env.NEXT_PUBLIC_MAP_TILE_URL_DARK;
const CUSTOM_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION;

const TILE_SOURCE = CUSTOM_LIGHT
  ? {
      url: { light: CUSTOM_LIGHT, dark: CUSTOM_DARK || CUSTOM_LIGHT } as Record<VizTheme, string>,
      attribution: CUSTOM_ATTRIBUTION || OSM_ATTRIBUTION,
      // 전용 다크 타일이 있으면 필터 불필요
      filtered: !CUSTOM_DARK,
    }
  : {
      url: { light: OSM_TILE_URL, dark: OSM_TILE_URL } as Record<VizTheme, string>,
      attribution: OSM_ATTRIBUTION,
      filtered: true,
    };

// 서울시청 (데이터가 없을 때의 기본 중심)
const DEFAULT_CENTER: L.LatLngTuple = [37.5665, 126.978];
const MIN_RADIUS = 6;
const MAX_RADIUS = 22;
// 이 수 이상 타일이 실패하고 성공이 없으면 안내를 띄운다
const TILE_ERROR_THRESHOLD = 4;

/** 총액 → 반지름 (제곱근 스케일: 원 면적이 금액에 비례) */
export function markerRadius(total: number, maxTotal: number): number {
  if (maxTotal <= 0) return MIN_RADIUS;
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(Math.max(0, total) / maxTotal);
}

function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}.${Number(d)}`;
}

/** fitKey가 바뀌면 범위에 맞춘다 */
function FitController({ bounds, fitKey }: { bounds: GeoBounds | null; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    // 동적 로드 직후 컨테이너 크기가 늦게 잡히는 경우 대비
    map.invalidateSize({ animate: false });
    const { south, west, north, east } = bounds;
    if (south === north && west === east) {
      map.setView([south, west], 15, { animate: false });
    } else {
      map.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        { padding: [MAX_RADIUS + 16, MAX_RADIUS + 16], maxZoom: 16, animate: false }
      );
    }
    // bounds 객체는 매 렌더 새로 만들어질 수 있으므로 fitKey로만 트리거
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  return null;
}

/** 목록에서 장소를 고르면 지도를 그 장소로 이동 */
function SelectionController({ place }: { place: SpendingMapPlace | null }) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (!place || place.key === lastKey.current) {
      lastKey.current = place?.key ?? null;
      return;
    }
    lastKey.current = place.key;
    const target = L.latLng(place.lat, place.lng);
    if (!map.getBounds().pad(-0.15).contains(target)) {
      map.panTo(target, { animate: true, duration: 0.4 });
    }
  }, [map, place]);
  return null;
}

/** 타일 로드 실패 감지 */
function TileHealth({ onFailure }: { onFailure: (failed: boolean) => void }) {
  const map = useMap();
  useEffect(() => {
    let errors = 0;
    let loaded = 0;
    const handleError = () => {
      errors += 1;
      if (loaded === 0 && errors >= TILE_ERROR_THRESHOLD) onFailure(true);
    };
    const handleLoad = () => {
      loaded += 1;
      onFailure(false);
    };
    map.on('tileerror', handleError);
    map.on('tileload', handleLoad);
    return () => {
      map.off('tileerror', handleError);
      map.off('tileload', handleLoad);
    };
  }, [map, onFailure]);
  return null;
}

export default function SpendingMap({
  places,
  selectedKey,
  onSelect,
  fitBounds,
  fitKey,
  theme,
  ariaLabel,
}: SpendingMapProps) {
  const [tilesFailed, setTilesFailed] = useState(false);
  // 작은 원도 누르기 쉽도록 캔버스 렌더러의 히트 허용 오차를 키운다
  const renderer = useMemo(() => L.canvas({ tolerance: 8, padding: 0.5 }), []);

  const maxTotal = useMemo(() => places.reduce((m, p) => Math.max(m, p.totalAmount), 0), [places]);
  const selectedPlace = useMemo(() => places.find((p) => p.key === selectedKey) ?? null, [places, selectedKey]);

  // 큰 원을 먼저 그려 작은 원이 위에 오도록, 선택된 원은 맨 위
  const ordered = useMemo(
    () =>
      [...places].sort((a, b) => {
        if (a.key === selectedKey) return 1;
        if (b.key === selectedKey) return -1;
        return b.totalAmount - a.totalAmount;
      }),
    [places, selectedKey]
  );

  const surface = VIZ_SURFACE_HEX[theme];
  const ink = VIZ_INK_HEX[theme];

  return (
    <div className="relative h-full w-full" role="region" aria-label={ariaLabel}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={12}
        className={cn(
          'spending-map h-full w-full',
          TILE_SOURCE.filtered && (theme === 'dark' ? 'spending-map--tone-dark' : 'spending-map--tone-light')
        )}
        renderer={renderer}
        scrollWheelZoom={false}
        dragging
        touchZoom
        doubleClickZoom
        tapTolerance={15}
        zoomControl={false}
        attributionControl={false}
        worldCopyJump
        minZoom={2}
      >
        <TileLayer
          key={theme}
          url={TILE_SOURCE.url[theme]}
          subdomains="abcd"
          maxZoom={19}
          attribution={TILE_SOURCE.attribution}
        />
        <AttributionControl position="bottomright" prefix={false} />
        <ZoomControl position="topright" zoomInTitle="확대" zoomOutTitle="축소" />
        <FitController bounds={fitBounds} fitKey={fitKey} />
        <SelectionController place={selectedPlace} />
        <TileHealth onFailure={setTilesFailed} />

        {ordered.map((place) => {
          const isSelected = place.key === selectedKey;
          const fill = slotHex(place.colorSlot, theme, MAP_SLOT_COUNT);
          return (
            <CircleMarker
              key={place.key}
              center={[place.lat, place.lng]}
              radius={markerRadius(place.totalAmount, maxTotal)}
              pathOptions={{
                color: isSelected ? ink : surface,
                weight: isSelected ? 3 : 2,
                fillColor: fill,
                fillOpacity: selectedKey && !isSelected ? 0.45 : 0.85,
              }}
              eventHandlers={{
                click: () => onSelect(isSelected ? null : place.key),
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                <div className="min-w-[120px]">
                  <p className="font-bold">{place.name}</p>
                  <p className="tabular-nums">
                    {place.count}회 · {formatWon(place.totalAmount)}
                  </p>
                  <p className="text-[11px] opacity-70">
                    {place.categoryName ? `${place.categoryName} · ` : ''}마지막 {shortDate(place.lastDate)}
                  </p>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {tilesFailed && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex items-center gap-2 rounded-xl bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-sm ring-1 ring-border"
        >
          <MapPinOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          지도 배경을 불러오지 못했어요. 위치 점과 아래 목록은 그대로 볼 수 있어요.
        </div>
      )}
    </div>
  );
}
