/**
 * AnimatedNumber — non-reduced-motion 경로 커버리지 테스트
 * 별도 파일로 분리하여 jest.mock이 파일 단위로 적용되는 특성을 활용합니다.
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';

const mockSet = jest.fn();
const mockUnsubscribe = jest.fn();
let onChangeCb: ((v: number) => void) | null = null;

// reduced motion = false → spring 구독 코드(lines 51-52)와 span 렌더링(lines 66-74) 실행
jest.mock('framer-motion', () => ({
  useReducedMotion: () => false,
  useSpring: () => ({
    set: mockSet,
    on: (_event: string, cb: (v: number) => void) => {
      onChangeCb = cb;
      return mockUnsubscribe;
    },
    get: () => 0,
  }),
}));

import { AnimatedNumber, CountUp } from '@/components/animation/AnimatedNumber';

beforeEach(() => {
  jest.clearAllMocks();
  onChangeCb = null;
});

describe('AnimatedNumber (non-reduced-motion)', () => {
  it('컴포넌트가 초기 value로 렌더링된다', () => {
    render(<AnimatedNumber value={5000} />);
    // useState 초기값은 format(value) = "5,000"
    expect(screen.getByText('5,000')).toBeInTheDocument();
  });

  it('spring.on이 "change" 이벤트로 등록된다', () => {
    render(<AnimatedNumber value={5000} />);
    expect(onChangeCb).not.toBeNull();
  });

  it('spring.on 콜백 호출 시 표시 값이 업데이트된다', () => {
    render(<AnimatedNumber value={5000} />);
    act(() => {
      onChangeCb?.(3000);
    });
    expect(screen.getByText('3,000')).toBeInTheDocument();
  });

  it('value 변경 시 spring.set이 호출된다', () => {
    const { rerender } = render(<AnimatedNumber value={1000} />);
    rerender(<AnimatedNumber value={2000} />);
    expect(mockSet).toHaveBeenCalledWith(2000);
  });

  it('prefix와 suffix가 span에 포함된다', () => {
    render(<AnimatedNumber value={0} prefix="₩" suffix="원" />);
    const span = screen.getByText(/₩/);
    expect(span.textContent).toContain('원');
  });

  it('unmount 시 spring.on 구독이 해제된다', () => {
    const { unmount } = render(<AnimatedNumber value={1000} />);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe('CountUp (non-reduced-motion)', () => {
  it('start 값으로 초기 렌더링된다', () => {
    // jsdom에서 requestAnimationFrame은 실행되지 않으므로 초기 start(0) 표시
    render(<CountUp end={100} start={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('end 값 변경 시 리렌더링된다', () => {
    const { rerender } = render(<CountUp end={10} />);
    rerender(<CountUp end={20} />);
    // jsdom에서는 rAF가 즉시 실행 안 되므로 최소한 에러 없이 렌더링되는 것을 확인
    expect(screen.getByRole('generic', { hidden: true })).toBeInTheDocument();
  });
});
