'use client';

import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QueryErrorStateProps {
  /** 재시도 콜백 (보통 react-query의 refetch) */
  onRetry?: () => void;
  /** 표시할 메시지 */
  message?: string;
  /** 전체 화면 높이로 중앙 정렬할지 여부 */
  fullHeight?: boolean;
}

/**
 * 데이터 조회 실패 시 표시하는 공용 에러 상태 컴포넌트.
 * 무한 스피너나 "내역 없음" 위장 대신 명확한 에러 + 재시도를 제공한다.
 */
export default function QueryErrorState({
  onRetry,
  message = '불러오지 못했어요',
  fullHeight = false,
}: QueryErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 px-6 py-10 text-center ${
        fullHeight ? 'min-h-dvh' : ''
      }`}
    >
      <AlertCircle className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/70">
        네트워크 연결을 확인한 뒤 다시 시도해 주세요.
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-1 h-10 gap-2"
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          다시 시도
        </Button>
      )}
    </div>
  );
}
