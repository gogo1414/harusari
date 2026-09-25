'use client';

import { Plus, Sparkles } from 'lucide-react';
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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3 pb-[env(safe-area-inset-bottom)]">
      {/* AI 빠른 입력: "삼각김밥 1400원"처럼 적으면 자동 분류 */}
      <motion.button
        onClick={() => router.push('/transactions/quick')}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card text-primary shadow-md transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="빠른 입력 (문장으로 입력)"
      >
        <Sparkles className="h-5 w-5" />
      </motion.button>
      <motion.button
        onClick={handleClick}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="새 내역 추가"
      >
        <Plus className="h-7 w-7" />
      </motion.button>
    </div>
  );
}
