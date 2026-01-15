import { render } from '@testing-library/react';
import {
  Skeleton,
  CalendarSkeleton,
  TransactionItemSkeleton,
  TransactionListSkeleton,
  StatCardSkeleton,
  SummaryCardSkeleton,
  ChartSkeleton,
  CategoryGridSkeleton,
  PageSkeleton,
} from './Skeleton';

describe('Skeleton', () => {
  it('renders basic skeleton', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-10 w-20" />);
    const skeleton = container.firstChild;
    expect(skeleton).toHaveClass('h-10', 'w-20');
  });
});

describe('CalendarSkeleton', () => {
  it('renders header and grid', () => {
    const { container } = render(<CalendarSkeleton />);
    // 헤더: 이전/다음 버튼 + 월 표시 (3개 스켈레톤)
    // 요일 헤더: 7개
    // 날짜 그리드: 35개
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3 + 7 + 35);
  });
});

describe('TransactionItemSkeleton', () => {
  it('renders transaction item skeleton', () => {
    const { container } = render(<TransactionItemSkeleton />);
    // 아이콘 + 제목/카테고리 + 금액 = 4개 스켈레톤
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(4);
  });
});

describe('TransactionListSkeleton', () => {
  it('renders default 5 items', () => {
    const { container } = render(<TransactionListSkeleton />);
    // 5개 아이템 x 4개 스켈레톤
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(20);
  });

  it('renders custom count', () => {
    const { container } = render(<TransactionListSkeleton count={3} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(12);
  });
});

describe('StatCardSkeleton', () => {
  it('renders stat card skeleton', () => {
    const { container } = render(<StatCardSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(2); // 라벨 + 값
  });
});

describe('SummaryCardSkeleton', () => {
  it('renders two summary cards', () => {
    const { container } = render(<SummaryCardSkeleton />);
    // 2개 카드 x 2개 스켈레톤 (라벨 + 값)
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(4);
  });
});

describe('ChartSkeleton', () => {
  it('renders donut chart skeleton by default', () => {
    const { container } = render(<ChartSkeleton />);
    // 도넛 + 범례 4개 = 5개
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(5);
  });

  it('renders bar chart skeleton', () => {
    const { container } = render(<ChartSkeleton type="bar" />);
    // 6개 막대 + 6개 라벨 = 12개
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(12);
  });
});

describe('CategoryGridSkeleton', () => {
  it('renders default 8 categories', () => {
    const { container } = render(<CategoryGridSkeleton />);
    // 8개 x 2개 (아이콘 + 라벨)
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(16);
  });

  it('renders custom count', () => {
    const { container } = render(<CategoryGridSkeleton count={4} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(8);
  });
});

describe('PageSkeleton', () => {
  it('renders page skeleton', () => {
    const { container } = render(<PageSkeleton />);
    // 헤더 2개 + 콘텐츠 3개 = 5개
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(5);
  });
});
