'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Wallet,
  Receipt,
  PiggyBank,
  TrendingUp,
  ListTodo,
  Search,
  FileQuestion,
} from 'lucide-react';

interface EmptyStateProps {
  // 아이콘 (이모지 문자열 또는 Lucide 아이콘 이름)
  icon?: string | 'wallet' | 'receipt' | 'piggybank' | 'trending' | 'list' | 'search' | 'question';
  // 제목
  title: string;
  // 설명 (선택)
  description?: string;
  // 액션 버튼 (선택)
  action?: {
    label: string;
    onClick: () => void;
  };
  // 추가 클래스
  className?: string;
  // 컴팩트 모드
  compact?: boolean;
}

// 아이콘 매핑
const iconMap = {
  wallet: Wallet,
  receipt: Receipt,
  piggybank: PiggyBank,
  trending: TrendingUp,
  list: ListTodo,
  search: Search,
  question: FileQuestion,
};

export function EmptyState({
  icon = 'wallet',
  title,
  description,
  action,
  className = '',
  compact = false,
}: EmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();

  // 아이콘 렌더링
  const renderIcon = () => {
    // 이모지인 경우
    if (icon.length <= 2 || !iconMap[icon as keyof typeof iconMap]) {
      return <span className="text-4xl">{icon}</span>;
    }

    // Lucide 아이콘인 경우
    const IconComponent = iconMap[icon as keyof typeof iconMap];
    return <IconComponent className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />;
  };

  const content = (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8' : 'py-16'
      } ${className}`}
    >
      {/* 아이콘 */}
      <div
        className={`flex items-center justify-center rounded-full bg-muted/50 ${
          compact ? 'mb-4 h-16 w-16' : 'mb-6 h-20 w-20'
        }`}
      >
        {renderIcon()}
      </div>

      {/* 제목 */}
      <p
        className={`font-bold text-foreground ${
          compact ? 'mb-1 text-base' : 'mb-2 text-xl'
        }`}
      >
        {title}
      </p>

      {/* 설명 */}
      {description && (
        <p
          className={`text-muted-foreground ${
            compact ? 'mb-4 max-w-[200px] text-xs' : 'mb-8 max-w-[240px] text-sm'
          }`}
        >
          {description}
        </p>
      )}

      {/* 액션 버튼 */}
      {action && (
        <Button
          onClick={action.onClick}
          size={compact ? 'sm' : 'lg'}
          className="rounded-2xl"
        >
          {action.label}
        </Button>
      )}
    </div>
  );

  // reduced motion 선호 시 애니메이션 없이 렌더링
  if (prefersReducedMotion) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {content}
    </motion.div>
  );
}

// 프리셋: 거래 없음
export function NoTransactions({
  onAdd,
  compact = false,
}: {
  onAdd?: () => void;
  compact?: boolean;
}) {
  return (
    <EmptyState
      icon="receipt"
      title="거래 내역이 없습니다"
      description="새로운 거래를 추가해보세요"
      action={onAdd ? { label: '거래 추가', onClick: onAdd } : undefined}
      compact={compact}
    />
  );
}

// 프리셋: 카테고리 없음
export function NoCategories({
  onAdd,
  compact = false,
}: {
  onAdd?: () => void;
  compact?: boolean;
}) {
  return (
    <EmptyState
      icon="list"
      title="카테고리가 없습니다"
      description="카테고리를 추가해서 지출을 관리해보세요"
      action={onAdd ? { label: '카테고리 추가', onClick: onAdd } : undefined}
      compact={compact}
    />
  );
}

// 프리셋: 검색 결과 없음
export function NoSearchResults({ query, compact = false }: { query?: string; compact?: boolean }) {
  return (
    <EmptyState
      icon="search"
      title="검색 결과가 없습니다"
      description={query ? `"${query}"에 대한 결과를 찾을 수 없습니다` : '다른 검색어를 시도해보세요'}
      compact={compact}
    />
  );
}

// 프리셋: 통계 없음
export function NoStats({ compact = false }: { compact?: boolean }) {
  return (
    <EmptyState
      icon="trending"
      title="분석할 데이터가 없습니다"
      description="거래를 추가하면 통계를 확인할 수 있습니다"
      compact={compact}
    />
  );
}
