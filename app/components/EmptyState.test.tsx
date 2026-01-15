import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState, NoTransactions, NoCategories, NoSearchResults, NoStats } from './EmptyState';

// framer-motion 모킹
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

describe('EmptyState', () => {
  it('renders with title', () => {
    render(<EmptyState title="테스트 제목" />);
    expect(screen.getByText('테스트 제목')).toBeInTheDocument();
  });

  it('renders with description', () => {
    render(<EmptyState title="제목" description="설명 텍스트입니다" />);
    expect(screen.getByText('설명 텍스트입니다')).toBeInTheDocument();
  });

  it('renders action button and handles click', () => {
    const handleClick = jest.fn();
    render(
      <EmptyState
        title="제목"
        action={{ label: '버튼 클릭', onClick: handleClick }}
      />
    );

    const button = screen.getByRole('button', { name: '버튼 클릭' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalled();
  });

  it('renders emoji icon', () => {
    render(<EmptyState icon="🎉" title="이모지 아이콘" />);
    expect(screen.getByText('🎉')).toBeInTheDocument();
  });

  it('renders compact variant', () => {
    const { container } = render(<EmptyState title="컴팩트" compact />);
    // 컴팩트 모드에서는 py-8 클래스가 적용됨
    expect(container.querySelector('.py-8')).toBeInTheDocument();
  });
});

describe('EmptyState Presets', () => {
  it('renders NoTransactions', () => {
    render(<NoTransactions />);
    expect(screen.getByText('거래 내역이 없습니다')).toBeInTheDocument();
  });

  it('renders NoTransactions with action', () => {
    const handleAdd = jest.fn();
    render(<NoTransactions onAdd={handleAdd} />);

    const button = screen.getByRole('button', { name: '거래 추가' });
    fireEvent.click(button);
    expect(handleAdd).toHaveBeenCalled();
  });

  it('renders NoCategories', () => {
    render(<NoCategories />);
    expect(screen.getByText('카테고리가 없습니다')).toBeInTheDocument();
  });

  it('renders NoSearchResults without query', () => {
    render(<NoSearchResults />);
    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument();
  });

  it('renders NoSearchResults with query', () => {
    render(<NoSearchResults query="테스트 검색어" />);
    expect(screen.getByText('"테스트 검색어"에 대한 결과를 찾을 수 없습니다')).toBeInTheDocument();
  });

  it('renders NoStats', () => {
    render(<NoStats />);
    expect(screen.getByText('분석할 데이터가 없습니다')).toBeInTheDocument();
  });
});
