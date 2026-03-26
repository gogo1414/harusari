import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import IconPicker, { CategoryIcon, ICON_MAP } from './IconPicker';

// Dialog는 Radix UI 기반이므로 간단히 모킹
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

describe('IconPicker', () => {
  const onClose = jest.fn();
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('isOpen=true이면 다이얼로그가 렌더링된다', () => {
    render(<IconPicker isOpen={true} onClose={onClose} onSelect={onSelect} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('아이콘 선택')).toBeInTheDocument();
  });

  it('isOpen=false이면 다이얼로그가 렌더링되지 않는다', () => {
    render(<IconPicker isOpen={false} onClose={onClose} onSelect={onSelect} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('ICON_MAP에 있는 모든 아이콘 버튼을 렌더링한다', () => {
    render(<IconPicker isOpen={true} onClose={onClose} onSelect={onSelect} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(Object.keys(ICON_MAP).length);
  });

  it('아이콘 버튼 클릭 시 onSelect와 onClose가 호출된다', () => {
    render(<IconPicker isOpen={true} onClose={onClose} onSelect={onSelect} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    // 첫 번째 아이콘 이름(ICON_MAP의 첫 키)이 전달됨
    expect(onSelect).toHaveBeenCalledWith(Object.keys(ICON_MAP)[0]);
  });

  it('currentIcon과 일치하는 버튼에 primary 스타일이 적용된다', () => {
    const firstIconName = Object.keys(ICON_MAP)[0]; // 'food'
    const { container } = render(
      <IconPicker isOpen={true} onClose={onClose} onSelect={onSelect} currentIcon={firstIconName} />
    );
    // bg-primary 클래스가 첫 번째 버튼에 있어야 함
    const primaryBtn = container.querySelector('.bg-primary');
    expect(primaryBtn).toBeInTheDocument();
  });
});

describe('CategoryIcon', () => {
  it('ICON_MAP에 있는 아이콘 이름으로 SVG를 렌더링한다', () => {
    const { container } = render(<CategoryIcon iconName="food" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('이모지 문자는 span으로 렌더링된다', () => {
    render(<CategoryIcon iconName="🍔" />);
    expect(screen.getByText('🍔')).toBeInTheDocument();
  });

  it('알 수 없는 이름이면 DollarSign(폴백) 아이콘을 렌더링한다', () => {
    const { container } = render(<CategoryIcon iconName="unknown_xyz" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('showBackground=true이면 배경색이 있는 wrapper를 렌더링한다', () => {
    const { container } = render(<CategoryIcon iconName="food" showBackground={true} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.backgroundColor).not.toBe('');
  });

  it('variant="circle"이면 rounded-full 클래스가 적용된다', () => {
    const { container } = render(<CategoryIcon iconName="food" variant="circle" />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });
});
