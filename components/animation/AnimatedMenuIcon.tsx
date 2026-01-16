'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

interface AnimatedMenuIconProps {
  isOpen: boolean;
  className?: string;
}

// 햄버거 → X 아이콘 애니메이션
export function AnimatedMenuIcon({ isOpen, className = '' }: AnimatedMenuIconProps) {
  const prefersReducedMotion = useReducedMotion();

  // reduced motion 선호 시 단순 아이콘 전환
  if (prefersReducedMotion) {
    return isOpen ? (
      <X className={`h-6 w-6 ${className}`} aria-hidden="true" />
    ) : (
      <Menu className={`h-6 w-6 ${className}`} aria-hidden="true" />
    );
  }

  return (
    <div className={`relative flex h-6 w-6 flex-col items-center justify-center ${className}`}>
      {/* 상단 라인 */}
      <motion.span
        animate={{
          rotate: isOpen ? 45 : 0,
          y: isOpen ? 0 : -6,
          width: isOpen ? 20 : 18,
        }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="absolute h-0.5 rounded-full bg-current"
        style={{ width: 18 }}
      />

      {/* 중간 라인 */}
      <motion.span
        animate={{
          opacity: isOpen ? 0 : 1,
          scaleX: isOpen ? 0 : 1,
        }}
        transition={{ duration: 0.15 }}
        className="absolute h-0.5 w-[18px] rounded-full bg-current"
      />

      {/* 하단 라인 */}
      <motion.span
        animate={{
          rotate: isOpen ? -45 : 0,
          y: isOpen ? 0 : 6,
          width: isOpen ? 20 : 14,
        }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="absolute h-0.5 rounded-full bg-current"
        style={{ width: 14 }}
      />
    </div>
  );
}

// 대안: 단순 크로스페이드 버전
export function CrossfadeMenuIcon({ isOpen, className = '' }: AnimatedMenuIconProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return isOpen ? (
      <X className={`h-6 w-6 ${className}`} aria-hidden="true" />
    ) : (
      <Menu className={`h-6 w-6 ${className}`} aria-hidden="true" />
    );
  }

  return (
    <div className={`relative h-6 w-6 ${className}`}>
      <motion.div
        initial={false}
        animate={{ opacity: isOpen ? 0 : 1, rotate: isOpen ? 90 : 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </motion.div>
      <motion.div
        initial={false}
        animate={{ opacity: isOpen ? 1 : 0, rotate: isOpen ? 0 : -90 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <X className="h-6 w-6" aria-hidden="true" />
      </motion.div>
    </div>
  );
}
