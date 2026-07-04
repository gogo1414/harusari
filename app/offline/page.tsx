import { WifiOff } from 'lucide-react';

// PWA 오프라인 fallback: 네트워크가 없을 때 서비스워커가 이 페이지를 대신 보여준다.
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-bold text-foreground">오프라인 상태예요</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        인터넷 연결이 끊겼어요. 연결이 복구되면 자동으로 다시 불러옵니다.
      </p>
    </div>
  );
}
