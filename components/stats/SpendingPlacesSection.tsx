'use client';

import { useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { MapPin, X } from 'lucide-react';
import type { Category } from '@/types/database';
import StatsCard, { SegmentedControl } from '@/components/stats/StatsCard';
import PlacesEmptyState from '@/components/stats/PlacesEmptyState';
import SpendingMapLazy from '@/components/map/SpendingMapLazy';
import type { SpendingMapPlace } from '@/components/map/SpendingMap';
import {
  aggregatePlaces,
  computeBounds,
  parseKoreanRegion,
  placesInCountry,
  rankPlaces,
  summarizeCountries,
  summarizeRegions,
  HOME_COUNTRY,
  type PlaceRankBy,
  type PlaceTransactionInput,
  type SpendingPlace,
} from '@/lib/stats/places';
import { MAP_SLOT_COUNT, formatCompactWon, formatWon, slotColor } from '@/lib/stats/series';
import { cn } from '@/lib/utils';

export type PlacePeriod = 'cycle' | 'recent';

interface SpendingPlacesSectionProps {
  /** 현재 사이클 거래 */
  cycleTransactions: readonly PlaceTransactionInput[];
  /** 최근 6사이클 거래 (추이 차트용으로 이미 조회한 데이터 재사용) */
  recentTransactions: readonly PlaceTransactionInput[];
  categories: readonly Category[];
  /** 카테고리 → 색 슬롯 (도넛과 공유) */
  categorySlots: Map<string, number>;
  /** 제외할 거래 (저축) */
  exclude: (t: PlaceTransactionInput) => boolean;
  /** 보고 있는 사이클이 진행 중인 사이클인지 (문구용) */
  isCurrentCycle: boolean;
  /** 최근 6사이클 개수 (문구용) */
  recentCycleCount: number;
}

const TOP_N = 5;
const PERIOD_OPTIONS = [
  { value: 'cycle', label: '이번 사이클' },
  { value: 'recent', label: '최근 6사이클' },
] as const;
const RANK_OPTIONS = [
  { value: 'amount', label: '금액' },
  { value: 'count', label: '횟수' },
] as const;

function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}.${Number(d)}`;
}

/** 목록 보조 줄에 쓸 지역 이름 (국내: 구, 해외: 국가) */
function placeRegionLabel(place: SpendingPlace): string | null {
  if (place.countryCode === HOME_COUNTRY) {
    const { district, city } = parseKoreanRegion(place.address);
    return district ?? city;
  }
  return null;
}

/** 위치가 기록된 지출 수 / 전체 지출 수 */
function locationCoverage(
  transactions: readonly PlaceTransactionInput[],
  exclude: (t: PlaceTransactionInput) => boolean
) {
  let total = 0;
  let located = 0;
  for (const t of transactions) {
    if (t.type !== 'expense' || exclude(t)) continue;
    total += 1;
    if (typeof t.latitude === 'number' && typeof t.longitude === 'number') located += 1;
  }
  return { total, located };
}

/** "어디서 썼나" — 지도 + 가장 많이 쓴 곳 순위 + 지역 요약 */
export default function SpendingPlacesSection({
  cycleTransactions,
  recentTransactions,
  categories,
  categorySlots,
  exclude,
  isCurrentCycle,
  recentCycleCount,
}: SpendingPlacesSectionProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const [period, setPeriod] = useState<PlacePeriod>('cycle');
  const [rankBy, setRankBy] = useState<PlaceRankBy>('amount');
  const [chosenCountry, setChosenCountry] = useState<string | null>(null);
  const [chosenRegion, setChosenRegion] = useState<string | null>(null);
  const [chosenPlace, setChosenPlace] = useState<string | null>(null);

  const cyclePlaces = useMemo(() => aggregatePlaces(cycleTransactions, { exclude }), [cycleTransactions, exclude]);
  const recentPlaces = useMemo(() => aggregatePlaces(recentTransactions, { exclude }), [recentTransactions, exclude]);
  const places = period === 'cycle' ? cyclePlaces : recentPlaces;

  const coverage = useMemo(
    () => locationCoverage(period === 'cycle' ? cycleTransactions : recentTransactions, exclude),
    [period, cycleTransactions, recentTransactions, exclude]
  );

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.category_id, c])), [categories]);

  // 국가 범위: 여러 나라면 기본값은 지출이 가장 큰 나라, '전체'는 'ALL'
  const countries = useMemo(() => summarizeCountries(places), [places]);
  const multiCountry = countries.length > 1;
  const countryId =
    chosenCountry === 'ALL' || (chosenCountry && countries.some((c) => c.id === chosenCountry))
      ? chosenCountry
      : (countries[0]?.id ?? null);
  const scopePlaces = useMemo(
    () => (!multiCountry || countryId === 'ALL' ? places : placesInCountry(places, countryId)),
    [places, multiCountry, countryId]
  );

  // 지역(구/국가) 요약 — 고르면 순위 목록과 지도 범위를 그 지역으로
  const regions = useMemo(() => summarizeRegions(scopePlaces), [scopePlaces]);
  const region = regions.find((r) => r.key === chosenRegion) ?? null;
  const visiblePlaces = useMemo(() => {
    if (!region) return scopePlaces;
    const keys = new Set(region.placeKeys);
    return scopePlaces.filter((p) => keys.has(p.key));
  }, [scopePlaces, region]);

  const ranked = useMemo(() => rankPlaces(visiblePlaces, rankBy).slice(0, TOP_N), [visiblePlaces, rankBy]);
  const visibleTotal = useMemo(
    () => visiblePlaces.reduce((sum, p) => sum + (rankBy === 'amount' ? p.totalAmount : p.count), 0),
    [visiblePlaces, rankBy]
  );

  const mapPlaces: SpendingMapPlace[] = useMemo(
    () =>
      scopePlaces.map((p) => {
        const slot = p.topCategoryId ? categorySlots.get(p.topCategoryId) : undefined;
        return {
          ...p,
          colorSlot: slot !== undefined && slot < MAP_SLOT_COUNT ? slot : null,
          categoryName: p.topCategoryId ? (categoryById.get(p.topCategoryId)?.name ?? null) : null,
        };
      }),
    [scopePlaces, categorySlots, categoryById]
  );

  // 지도 범례: 지도에 보이는 색 (상위 3개 카테고리 + 기타)
  const mapLegend = useMemo(() => {
    const seen = new Map<number, string>();
    let hasOther = false;
    for (const p of mapPlaces) {
      if (p.colorSlot === null) hasOther = true;
      else if (!seen.has(p.colorSlot)) {
        const id = p.topCategoryId;
        seen.set(p.colorSlot, (id && categoryById.get(id)?.name) || '미분류');
      }
    }
    const items = [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([slot, name]) => ({ key: String(slot), name, color: slotColor(slot) }));
    if (hasOther) items.push({ key: 'other', name: '기타', color: slotColor(null) });
    return items;
  }, [mapPlaces, categoryById]);

  const selectedPlace = scopePlaces.find((p) => p.key === chosenPlace) ?? null;
  const fitBounds = useMemo(() => computeBounds(visiblePlaces), [visiblePlaces]);
  const fitKey = `${period}|${countryId}|${region?.key ?? ''}|${visiblePlaces.length}`;

  const periodWord = period === 'cycle' ? (isCurrentCycle ? '이번 사이클' : '이 사이클') : `최근 ${recentCycleCount}사이클`;
  const topByAmount = places[0] ?? null;
  const topByCount = useMemo(() => rankPlaces(places, 'count')[0] ?? null, [places]);

  const handlePeriod = (next: PlacePeriod) => {
    setPeriod(next);
    setChosenCountry(null);
    setChosenRegion(null);
    setChosenPlace(null);
  };
  const handleCountry = (id: string) => {
    setChosenCountry(id);
    setChosenRegion(null);
    setChosenPlace(null);
  };
  const handleRegion = (key: string) => {
    setChosenRegion((prev) => (prev === key ? null : key));
    setChosenPlace(null);
  };

  const noLocationsAtAll = cyclePlaces.length === 0 && recentPlaces.length === 0;

  return (
    <StatsCard
      title="어디서 썼나"
      description={
        noLocationsAtAll ? '위치가 기록된 지출을 지도로 보여드려요' : `${periodWord} · 위치가 있는 지출 ${coverage.located}건 / ${coverage.total}건`
      }
    >
      {noLocationsAtAll ? (
        <PlacesEmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          <SegmentedControl
            ariaLabel="지도 기간"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={handlePeriod}
            className="self-start"
          />

          {places.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-2xl bg-secondary/30 p-4 text-sm text-muted-foreground">
              <p>{periodWord}에는 위치가 기록된 지출이 없어요.</p>
              <button
                type="button"
                onClick={() => handlePeriod('recent')}
                className="min-h-11 font-semibold text-primary underline-offset-4 hover:underline"
              >
                최근 {recentCycleCount}사이클 지도 보기
              </button>
            </div>
          ) : (
            <>
              {/* 핵심 인사이트 */}
              {topByAmount && (
                <div className="rounded-2xl bg-primary/5 px-4 py-3 ring-1 ring-primary/15">
                  <p className="break-keep text-[15px] font-semibold leading-snug text-foreground">
                    {periodWord}은 <strong className="font-extrabold">{topByAmount.name}</strong>에서 가장 많이 썼어요{' '}
                    <span className="whitespace-nowrap text-[13px] font-medium text-muted-foreground">
                      ({topByAmount.count}회 · {formatWon(topByAmount.totalAmount)})
                    </span>
                  </p>
                  {topByCount && topByCount.key !== topByAmount.key && topByCount.count > 1 && (
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      가장 자주 간 곳은 <strong className="font-semibold text-foreground">{topByCount.name}</strong> (
                      {topByCount.count}회)
                    </p>
                  )}
                </div>
              )}

              {/* 국가 빠른 이동 (여러 나라에서 썼을 때만) */}
              {multiCountry && (
                <div role="group" aria-label="나라별로 보기" className="hide-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-1">
                  {countries.map((c) => (
                    <Chip key={c.id} active={countryId === c.id} onClick={() => handleCountry(c.id)}>
                      <span aria-hidden="true">{c.flag}</span>
                      {c.label}
                      <span className="font-medium tabular-nums opacity-70">{formatCompactWon(c.totalAmount)}</span>
                    </Chip>
                  ))}
                  <Chip active={countryId === 'ALL'} onClick={() => handleCountry('ALL')}>
                    전체
                  </Chip>
                </div>
              )}

              {/* 지도 (isolate: Leaflet z-index가 상단 헤더 위로 올라오지 않도록) */}
              <div className="flex flex-col gap-2">
                <div className="isolate h-[280px] overflow-hidden rounded-2xl ring-1 ring-border/60">
                  <SpendingMapLazy
                    places={mapPlaces}
                    selectedKey={selectedPlace?.key ?? null}
                    onSelect={setChosenPlace}
                    fitBounds={fitBounds}
                    fitKey={fitKey}
                    theme={theme}
                    ariaLabel={`지출 장소 지도: ${scopePlaces.length}곳. 아래 목록에서 같은 정보를 볼 수 있어요.`}
                  />
                </div>
                {mapLegend.length > 0 && (
                  <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground" aria-label="지도 범례">
                    {mapLegend.map((item) => (
                      <li key={item.key} className="flex items-center gap-1">
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </li>
                    ))}
                    <li className="ml-auto">원 크기 = 지출 금액</li>
                  </ul>
                )}
              </div>

              {/* 선택한 장소 상세 */}
              {selectedPlace && (
                <div
                  className="flex items-start gap-3 rounded-2xl bg-secondary/40 py-3 pl-4 pr-1"
                  role="status"
                  aria-live="polite"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-foreground">{selectedPlace.name}</p>
                    {selectedPlace.hasName && selectedPlace.address && (
                      <p className="truncate text-xs text-muted-foreground">{selectedPlace.address}</p>
                    )}
                    <p className="mt-1 text-[13px] text-foreground">
                      <span className="font-bold tabular-nums">{formatWon(selectedPlace.totalAmount)}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {selectedPlace.count}회 · 마지막 {shortDate(selectedPlace.lastDate)}
                        {selectedPlace.topCategoryId && categoryById.get(selectedPlace.topCategoryId)
                          ? ` · ${categoryById.get(selectedPlace.topCategoryId)!.name}`
                          : ''}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChosenPlace(null)}
                    aria-label="선택 해제"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* 지역 요약 (국내: 구, 해외: 나라) */}
              {regions.length > 1 && (
                <div role="group" aria-label="지역별로 보기" className="hide-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-1">
                  {regions.slice(0, 8).map((r) => (
                    <Chip key={r.key} active={region?.key === r.key} onClick={() => handleRegion(r.key)} title={r.sublabel ?? undefined}>
                      {r.flag && <span aria-hidden="true">{r.flag}</span>}
                      {r.label}
                      <span className="font-medium tabular-nums opacity-70">{formatCompactWon(r.totalAmount)}</span>
                    </Chip>
                  ))}
                </div>
              )}

              {/* 가장 많이 쓴 곳 순위 */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[15px] font-bold text-foreground">
                    {rankBy === 'amount' ? '가장 많이 쓴 곳' : '가장 자주 간 곳'}
                    {region && <span className="ml-1 text-[13px] font-medium text-muted-foreground">· {region.label}</span>}
                  </h3>
                  <SegmentedControl ariaLabel="순위 기준" options={RANK_OPTIONS} value={rankBy} onChange={setRankBy} />
                </div>
                <ol className="flex flex-col">
                  {ranked.map((place, index) => {
                    const metric = rankBy === 'amount' ? place.totalAmount : place.count;
                    const share = visibleTotal > 0 ? metric / visibleTotal : 0;
                    const selected = place.key === selectedPlace?.key;
                    const regionLabel = placeRegionLabel(place);
                    return (
                      <li key={place.key}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setChosenPlace(selected ? null : place.key)}
                          className={cn(
                            'flex min-h-14 w-full flex-col gap-1.5 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/40',
                            selected && 'bg-primary/5 ring-2 ring-primary/50'
                          )}
                        >
                          <span className="flex w-full items-center gap-3">
                            <span
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                                index === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                              )}
                            >
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold text-foreground">{place.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {place.count}회{regionLabel ? ` · ${regionLabel}` : ''} · 마지막 {shortDate(place.lastDate)}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-[15px] font-bold tabular-nums text-foreground">
                                {formatWon(place.totalAmount)}
                              </span>
                              <span className="block text-xs tabular-nums text-muted-foreground">
                                {Math.round(share * 100)}%
                              </span>
                            </span>
                          </span>
                          {/* 비중 막대 */}
                          <span className="ml-9 block h-1.5 overflow-hidden rounded-full bg-secondary/70" aria-hidden="true">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${Math.max(2, share * 100)}%`, backgroundColor: 'var(--viz-1)' }}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {visiblePlaces.length > TOP_N && (
                  <p className="px-2 text-xs text-muted-foreground">외 {visiblePlaces.length - TOP_N}곳</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </StatsCard>
  );
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={cn(
        // 시각 36px + 확장 히트 영역 44px
        "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1 transition-colors after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']",
        active
          ? 'bg-foreground text-background ring-foreground'
          : 'bg-card text-foreground ring-border hover:bg-secondary/50'
      )}
    >
      {children}
    </button>
  );
}
