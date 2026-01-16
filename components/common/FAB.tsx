'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';

import { format } from 'date-fns';

interface FABProps {
  selectedDate?: Date | null;
}

export default function FAB({ selectedDate }: FABProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  // reduced motion 선호 시 단순 버튼
  if (prefersReducedMotion) {
    return (
      <button
        onClick={() => {
          const url = selectedDate 
            ? `/transactions/new?date=${format(selectedDate, 'yyyy-MM-dd')}`
            : '/transactions/new';
          router.push(url);
        }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        aria-label="새 거래 추가"
      >
        <Plus className="h-7 w-7" aria-hidden="true" />
      </button>
    );
  }

  return (
    <motion.button
      onClick={() => {
        const url = selectedDate 
          ? `/transactions/new?date=${format(selectedDate, 'yyyy-MM-dd')}`
          : '/transactions/new';
        router.push(url);
      }}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
      aria-label="새 거래 추가"
      // 호버/탭 애니메이션
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      // 초기 진입 애니메이션
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 20,
        delay: 0.3,
      }}
    >
      <motion.div
        whileHover={{ rotate: 90 }}
        transition={{ duration: 0.2 }}
      >
        <Plus className="h-7 w-7" aria-hidden="true" />
      </motion.div>
    </motion.button>
  );
}
