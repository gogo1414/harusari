import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  AnimatedNumber,
  AnimatedCurrency,
  AnimatedPercent,
  CountUp,
} from '@/components/animation/AnimatedNumber';

// reduced motion = true 로 고정 → 즉각 값 렌더링, 애니메이션 없음
jest.mock('framer-motion', () => ({
  useReducedMotion: () => true,
  useSpring: () => ({
    set: jest.fn(),
    on: jest.fn(() => jest.fn()),
    get: jest.fn(() => 0),
  }),
}));

describe('AnimatedNumber (reduced motion)', () => {
  it('기본 포맷으로 숫자를 표시한다', () => {
    render(<AnimatedNumber value={50000} />);
    expect(screen.getByText('50,000')).toBeInTheDocument();
  });

  it('커스텀 format 함수를 적용한다', () => {
    render(<AnimatedNumber value={1234} format={(n) => `$${n}`} />);
    expect(screen.getByText('$1234')).toBeInTheDocument();
  });

  it('prefix와 suffix를 포함하여 표시한다', () => {
    render(<AnimatedNumber value={1000} prefix="₩" suffix="원" />);
    const span = screen.getByText(/1,000/);
    expect(span.textContent).toContain('₩');
    expect(span.textContent).toContain('원');
  });

  it('className이 span에 적용된다', () => {
    const { container } = render(<AnimatedNumber value={0} className="test-class" />);
    expect(container.querySelector('.test-class')).toBeInTheDocument();
  });

  it('0을 "0"으로 표시한다', () => {
    render(<AnimatedNumber value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

describe('AnimatedCurrency (reduced motion)', () => {
  it('원화 금액을 "원" 단위로 표시한다', () => {
    render(<AnimatedCurrency value={100000} />);
    expect(screen.getByText(/100,000/).textContent).toContain('원');
  });

  it('수입 타입이면 text-income 클래스가 적용된다', () => {
    const { container } = render(<AnimatedCurrency value={50000} type="income" />);
    expect(container.querySelector('.text-income')).toBeInTheDocument();
  });

  it('지출 타입이면 text-expense 클래스가 적용된다', () => {
    const { container } = render(<AnimatedCurrency value={50000} type="expense" />);
    expect(container.querySelector('.text-expense')).toBeInTheDocument();
  });

  it('neutral 타입이면 컬러 클래스가 없다', () => {
    const { container } = render(<AnimatedCurrency value={50000} type="neutral" />);
    expect(container.querySelector('.text-income')).toBeNull();
    expect(container.querySelector('.text-expense')).toBeNull();
  });

  it('showSign=true이고 양수이면 "+" 접두사를 표시한다', () => {
    render(<AnimatedCurrency value={10000} showSign={true} />);
    expect(screen.getByText(/10,000/).textContent).toContain('+');
  });

  it('showSign=true이고 음수이면 "-" 접두사를 표시하고 절댓값을 사용한다', () => {
    render(<AnimatedCurrency value={-5000} showSign={true} />);
    expect(screen.getByText(/5,000/).textContent).toContain('-');
  });

  it('showSign=false이고 양수이면 접두사가 없다', () => {
    render(<AnimatedCurrency value={10000} showSign={false} />);
    expect(screen.getByText(/10,000/).textContent).not.toContain('+');
  });

  it('음수 value는 절댓값으로 표시된다', () => {
    render(<AnimatedCurrency value={-30000} />);
    expect(screen.getByText(/30,000/)).toBeInTheDocument();
  });
});

describe('AnimatedPercent (reduced motion)', () => {
  it('기본 소수점 1자리로 퍼센트를 표시한다', () => {
    render(<AnimatedPercent value={75.5} />);
    expect(screen.getByText(/75\.5/).textContent).toContain('%');
  });

  it('decimals=0이면 정수로 표시한다', () => {
    render(<AnimatedPercent value={50} decimals={0} />);
    expect(screen.getByText(/50/).textContent).toContain('%');
  });

  it('className이 적용된다', () => {
    const { container } = render(<AnimatedPercent value={30} className="percent-class" />);
    expect(container.querySelector('.percent-class')).toBeInTheDocument();
  });
});

describe('CountUp (reduced motion)', () => {
  it('reduced motion이면 즉시 end 값을 표시한다', () => {
    render(<CountUp end={100} start={0} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('큰 숫자는 천 단위 콤마로 포맷된다', () => {
    render(<CountUp end={1000000} />);
    expect(screen.getByText('1,000,000')).toBeInTheDocument();
  });

  it('className이 span에 적용된다', () => {
    const { container } = render(<CountUp end={10} className="count-class" />);
    expect(container.querySelector('.count-class')).toBeInTheDocument();
  });

  it('start 없이 0부터 시작해도 end 값을 표시한다', () => {
    render(<CountUp end={999} />);
    expect(screen.getByText('999')).toBeInTheDocument();
  });
});
