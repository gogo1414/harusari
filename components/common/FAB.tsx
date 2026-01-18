'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

interface FABProps {
  selectedDate?: Date | null;
}

export default function FAB({ selectedDate }: FABProps) {
  const router = useRouter();

  const handleClick = () => {
    // 햅틱 피드백 (모바일)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    const url = selectedDate 
      ? `/transactions/new?date=${format(selectedDate, 'yyyy-MM-dd')}`
      : '/transactions/new';
    router.push(url);
  };

  return (
    <motion.button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="새 내역 추가"
    >
      <Plus className="h-7 w-7" />
    </motion.button>
  );
}
