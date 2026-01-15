'use client';

import { useEffect, useRef, useState } from 'react';
import { useSpring, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  // 포맷 함수 (기본: 천 단위 콤마)
  format?: (n: number) => string;
  // 애니메이션 지속 시간 조절
  duration?: number;
  // CSS 클래스
  className?: string;
  // 접두사 (예: ₩, $)
  prefix?: string;
  // 접미사 (예: 원, won)
  suffix?: string;
}

// 기본 포맷: 천 단위 콤마
const defaultFormat = (n: number) => {
  return Math.round(n).toLocaleString('ko-KR');
};

export function AnimatedNumber({
  value,
  format = defaultFormat,
  duration = 0.4,
  className = '',
  prefix = '',
  suffix = '',
}: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(format(value));

  // 스프링 애니메이션 설정
  const spring = useSpring(0, {
    damping: 30,
    stiffness: 100,
    duration: prefersReducedMotion ? 0 : duration,
  });

  // 값이 변경될 때 애니메이션 시작
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  // 스프링 값이 변경될 때 표시 값 업데이트
  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      setDisplayValue(format(latest));
    });
    return () => unsubscribe();
  }, [spring, format]);

  // reduced motion 선호 시 즉시 표시
  if (prefersReducedMotion) {
    return (
      <span className={className}>
        {prefix}
        {format(value)}
        {suffix}
      </span>
    );
  }

  return (
    <span className={className}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}

// 금액 전용 컴포넌트 (원화)
interface AnimatedCurrencyProps {
  value: number;
  className?: string;
  showSign?: boolean;
  type?: 'income' | 'expense' | 'neutral';
}

export function AnimatedCurrency({
  value,
  className = '',
  showSign = false,
  type = 'neutral',
}: AnimatedCurrencyProps) {
  const absValue = Math.abs(value);
  const sign = showSign && value > 0 ? '+' : showSign && value < 0 ? '-' : '';

  // 타입에 따른 색상 클래스
  const colorClass =
    type === 'income'
      ? 'text-income'
      : type === 'expense'
        ? 'text-expense'
        : '';

  return (
    <AnimatedNumber
      value={absValue}
      prefix={sign}
      suffix="원"
      className={`${colorClass} ${className}`.trim()}
      duration={0.4}
    />
  );
}

// 퍼센트 전용 컴포넌트
interface AnimatedPercentProps {
  value: number;
  className?: string;
  decimals?: number;
}

export function AnimatedPercent({
  value,
  className = '',
  decimals = 1,
}: AnimatedPercentProps) {
  const format = (n: number) => n.toFixed(decimals);

  return (
    <AnimatedNumber
      value={value}
      format={format}
      suffix="%"
      className={className}
    />
  );
}

// 카운트업 컴포넌트 (정수 전용)
interface CountUpProps {
  end: number;
  start?: number;
  duration?: number;
  className?: string;
}

export function CountUp({
  end,
  start = 0,
  duration = 0.5,
  className = '',
}: CountUpProps) {
  const prefersReducedMotion = useReducedMotion();
  const [count, setCount] = useState(() => prefersReducedMotion ? end : start);
  const countRef = useRef(prefersReducedMotion ? end : start);

  useEffect(() => {
    // reduced motion이면 애니메이션 건너뛰기
    if (prefersReducedMotion) {
      return;
    }

    const startTime = Date.now();
    const diff = end - start;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + diff * eased);

      if (current !== countRef.current) {
        countRef.current = current;
        setCount(current);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [end, start, duration, prefersReducedMotion]);

  // reduced motion이면 직접 값 표시
  const displayValue = prefersReducedMotion ? end : count;

  return <span className={className}>{displayValue.toLocaleString('ko-KR')}</span>;
}
