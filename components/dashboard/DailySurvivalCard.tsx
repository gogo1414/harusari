'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { useUserSettings } from '@/app/context/UserSettingsContext';
import { useBudgetGoals } from '@/hooks/useBudgetGoals';

import type { Transaction } from '@/types/database';

interface DailySurvivalCardProps {
  currentDate: Date;
  transactions: Transaction[];
  cycleEndDate: Date;
  onOpenSettings?: () => void;
}

export default function DailySurvivalCard({ 
  currentDate, 
  transactions, 
  cycleEndDate,
}: DailySurvivalCardProps) {
  const router = useRouter();
  const { settings } = useUserSettings();
  const { budgetGoals } = useBudgetGoals();
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. 전체 목표 예산 조회 (카테고리별 예산 합계, 전체 예산 항목 제외)
  const totalBudgetGoal = useMemo(() => {
    return budgetGoals
      .filter(g => g.category_id !== null)
      .reduce((sum, goal) => sum + goal.amount, 0);
  }, [budgetGoals]);

  // 2. 계산 로직
  const { 
    dailyAvailable, 
    remainingBudget, 
    remainingDays, 
    status,
    hasBudget,
    currentSpent
  } = useMemo(() => {
    const budget = totalBudgetGoal;
    
    // 예산 미설정 시
    if (!budget) {
        return { 
            dailyAvailable: 0, 
            remainingBudget: 0, 
            remainingDays: 0, 
            status: 'unknown' as const,
            hasBudget: false,
            currentSpent: 0
        };
    }

    // 예산이 설정된 카테고리 ID 목록
    const budgetedCategoryIds = new Set(
        budgetGoals
            .filter(g => g.category_id !== null)
            .map(g => g.category_id)
    );

    // 실제 지출액 계산 (고정 지출 제외, 예산 설정된 카테고리만 포함)
    const currentSpent = transactions
        .filter(t => 
            t.type === 'expense' &&                    // 지출만
            !t.source_fixed_id &&                     // 고정 지출 제외
            t.category_id && budgetedCategoryIds.has(t.category_id) // 예산 설정된 카테고리만
        )
        .reduce((sum, t) => sum + t.amount, 0);

    // 남은 일수 계산 (오늘 포함)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(cycleEndDate);
    end.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(end.getTime() - today.getTime());
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // 남은 생활비 = 총예산 - 현재 총지출
    const disposableBalance = budget - currentSpent;

    // 하루 권장 사용액
    const daily = Math.floor(disposableBalance / Math.max(1, daysLeft));

    // 상태 결정
    let currentStatus: 'safe' | 'warning' | 'danger' = 'safe';
    
    // 하루 권장액이 0 이하면 위험
    if (daily <= 0) currentStatus = 'danger';
    
    // 하루 권장액이 (월 목표 / 30)의 50% 미만이면 경고
    if (daily < (budget / 30) * 0.5) currentStatus = 'warning';

    return {
      dailyAvailable: daily,
      remainingBudget: disposableBalance,
      remainingDays: daysLeft,
      status: currentStatus,
      hasBudget: true,
      currentSpent
    };
  }, [totalBudgetGoal, transactions, cycleEndDate, budgetGoals]);

  // 3. 스타일 정의
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
            "relative w-full rounded-[32px] p-6 text-white shadow-xl overflow-hidden transition-all cursor-pointer",
            "bg-gradient-to-br",
            getGradientStyle()
        )}
        whileTap={{ scale: 0.98 }}
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
                     <div className="mt-6 pt-6 border-t border-white/20 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                           <span className="opacity-80">이번 달 목표</span>
                           <span className="font-bold">{totalBudgetGoal.toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                           <span className="opacity-80">현재까지 지출</span>
                           <span className="font-bold">-{currentSpent.toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                           <span className="opacity-80">남은 예산</span>
                           <div className="flex items-center gap-1 font-bold">
                              {remainingBudget < 0 && <AlertCircle className="w-4 h-4 text-white" />}
                              {remainingBudget.toLocaleString()}원
                           </div>
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
