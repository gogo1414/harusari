import Link from 'next/link';
import { MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 위치가 기록된 지출이 하나도 없을 때 (지도 대신 안내) */
export default function PlacesEmptyState() {
  return (
    <div className="flex flex-col gap-4 break-keep rounded-2xl bg-secondary/30 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[15px] font-bold text-foreground">어디서 썼는지 지도로 볼 수 있어요</p>
          <p className="text-[13px] text-muted-foreground">
            거래를 입력할 때 위치를 추가하면 지도로 보여드려요.
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-2 text-[13px] text-foreground">
        <Step n={1}>
          지출을 입력하면 <strong className="font-semibold">위치</strong> 항목에 현재 위치가 자동으로 채워져요
          <span className="text-muted-foreground"> (위치 권한 허용 시)</span>
        </Step>
        <Step n={2}>다른 곳에서 썼다면 위치를 눌러 장소를 검색해 바꿀 수 있어요</Step>
        <Step n={3}>저장하면 여기에서 자주 가는 곳, 가장 많이 쓴 곳을 보여드려요. 해외 여행 지출은 나라별로 모아 드려요</Step>
      </ol>

      <Button asChild className="h-11 rounded-xl font-semibold">
        <Link href="/transactions/new">
          <Plus className="h-4 w-4" aria-hidden="true" />
          지출 입력하러 가기
        </Link>
      </Button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden="true"
        className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold text-muted-foreground ring-1 ring-border"
      >
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
