'use client';

import { motion, AnimatePresence, useReducedMotion, Variants } from 'framer-motion';
import { ReactNode, Children, isValidElement } from 'react';

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  // 스태거 딜레이 (초)
  staggerDelay?: number;
  // 애니메이션 방향
  direction?: 'up' | 'down' | 'left' | 'right';
}

// 컨테이너 variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

// 아이템 variants (방향별)
const getItemVariants = (direction: 'up' | 'down' | 'left' | 'right'): Variants => {
  const offset = 12;
  const transforms = {
    up: { y: offset },
    down: { y: -offset },
    left: { x: offset },
    right: { x: -offset },
  };

  return {
    hidden: {
      opacity: 0,
      ...transforms[direction],
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: 0.25,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
    exit: {
      opacity: 0,
      ...transforms[direction],
      transition: {
        duration: 0.15,
      },
    },
  };
};

export function AnimatedList({
  children,
  className = '',
  staggerDelay = 0.05,
  direction = 'up',
}: AnimatedListProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const itemVariants = getItemVariants(direction);
  const customContainerVariants: Variants = {
    ...containerVariants,
    visible: {
      ...containerVariants.visible,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.02,
      },
    },
  };

  return (
    <motion.div
      variants={customContainerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;

        return (
          <motion.div key={child.key ?? index} variants={itemVariants}>
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// 개별 아이템용 wrapper
interface AnimatedListItemProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function AnimatedListItem({
  children,
  className = '',
  delay = 0,
}: AnimatedListItemProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.25,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 페이드 인 리스트 (단순 버전)
interface FadeListProps {
  children: ReactNode;
  className?: string;
}

export function FadeList({ children, className = '' }: FadeListProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// AnimatePresence 래퍼 (리스트 아이템 추가/삭제용)
interface AnimatedPresenceListProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedPresenceList({ children, className = '' }: AnimatedPresenceListProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        {Children.map(children, (child) => {
          if (!isValidElement(child)) return child;

          return (
            <motion.div
              key={child.key}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.2,
                layout: { duration: 0.2 },
              }}
            >
              {child}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
