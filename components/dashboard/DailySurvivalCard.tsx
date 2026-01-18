'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { useBudgetGoals } from '@/hooks/useBudgetGoals';
import { useDailySurvival } from '@/hooks/useDailySurvival';
import CategoryBudgetRow from './CategoryBudgetRow';

import type { Transaction } from '@/types/database';

interface DailySurvivalCardProps {
  currentDate: Date;
  transactions: Transaction[];
  cycleEndDate: Date;
  onOpenSettings?: () => void;
}

export default function DailySurvivalCard({ 
  transactions, 
  cycleEndDate,
}: DailySurvivalCardProps) {
  const router = useRouter();
  const { budgetGoals } = useBudgetGoals();
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. 예산 및 생존 금액 계산 로직 (커스텀 훅)
  const { 
    totalBudgetGoal, 
    categoryStats, 
    currentSpent, 
    dailyAvailable, 
    remainingBudget, 
    status, 
    hasBudget 
  } = useDailySurvival({
    transactions,
    budgetGoals,
    cycleEndDate
  });

  // 스타일 정의
  const getGradientStyle = () => {
    if (!hasBudget) return 'from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900';
    
    switch (status) {
      case 'danger':
        return 'from-rose-500 to-red-600 animate-pulse-slow';
      case 'warning':
        return 'from-orange-400 to-amber-500';
      case 'safe':
      default:
        return 'from-cyan-500 to-blue-600';
    }
  };



  // 4. 렌더링
  if (!hasBudget) return null;

  return (
    <div className="px-6 pt-2 pb-6">
      <motion.div
        layout
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
            "relative w-full rounded-[32px] p-6 text-white shadow-xl overflow-hidden transition-all cursor-pointer active:scale-[0.98]",
            "bg-gradient-to-br",
            getGradientStyle()
        )}
      >
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] opacity-0 hover:opacity-100 transition-opacity" />

        <div className="relative z-10">
              {/* 상단: 헤더 */}
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                   {status === 'danger' ? '💸 무지출 챌린지 시작!' : '오늘의 생존 금액'}
                </span>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        router.push('/budget-settings');
                    }}
                    className="text-xs font-medium opacity-80 hover:opacity-100 underline decoration-white/50 underline-offset-2"
                >
                  예산 수정
                </button>
              </div>

              {/* 메인: 금액 */}
              <div className="mt-2 text-center">
                  <motion.div
                    key={dailyAvailable}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="font-extrabold text-5xl tracking-tight"
                  >
                    {dailyAvailable < 0 ? 0 : dailyAvailable.toLocaleString()}
                    <span className="text-2xl ml-1 font-semibold opacity-70">원</span>
                  </motion.div>
                  <p className="text-sm mt-2 opacity-90 font-medium">
                    {dailyAvailable < 0 
                        ? "내일 예산을 당겨 쓰고 있어요 😭"
                        : "오늘 이만큼 써도 괜찮아요"}
                  </p>
              </div>

              {/* 확장 영역 */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                     <div className="mt-6 pt-6 border-t border-white/20 space-y-4">
                        {/* 전체 요약 */}
                        <div className="space-y-2 pb-4 border-b border-white/10">
                            <div className="flex justify-between items-center text-sm">
                               <span className="opacity-80">전체 예산</span>
                               <span className="font-bold">{totalBudgetGoal.toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                               <span className="opacity-80">전체 지출</span>
                               <span className="font-bold">-{currentSpent.toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                               <span className="opacity-80">전체 잔액</span>
                               <div className="flex items-center gap-1 font-bold">
                                  {remainingBudget < 0 && <AlertCircle className="w-4 h-4 text-white" />}
                                  {remainingBudget.toLocaleString()}원
                               </div>
                            </div>
                        </div>

                        {/* 카테고리별 리스트 */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold opacity-70 mb-2">카테고리별 현황</p>
                            {categoryStats.map((stat) => (
                                <CategoryBudgetRow 
                                    key={stat.id} 
                                    stat={stat} 
                                    onClick={() => router.push(`/stats?category=${stat.category_id}`)} 
                                />
                            ))}
                        </div>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {!isExpanded && (
                 <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 0.6 }}
                   className="text-[10px] text-center mt-6"
                 >
                    터치해서 상세 내역 보기
                 </motion.div>
              )}
        </div>
      </motion.div>
    </div>
  );
}
