'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CategoryIcon } from '@/components/category/IconPicker';

interface CategoryStats {
    id: string;
    category_id: string | null;
    amount: number;
    spent: number;
    percentage: number;
    status: 'safe' | 'warning' | 'danger';
    categoryName: string;
    categoryIcon: string;
}

interface CategoryBudgetRowProps {
    stat: CategoryStats;
    onClick: () => void;
}

export default function CategoryBudgetRow({ stat, onClick }: CategoryBudgetRowProps) {
    const getProgressColor = (status: 'safe' | 'warning' | 'danger') => {
        switch(status) {
            case 'danger': return 'bg-red-500';
            case 'warning': return 'bg-orange-400';
            case 'safe': return 'bg-emerald-400';
            default: return 'bg-white/50';
        }
    };

    return (
        <div 
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className="bg-black/10 rounded-xl p-3 backdrop-blur-sm active:bg-black/20 transition-colors cursor-pointer"
        >
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <CategoryIcon 
                        iconName={stat.categoryIcon} 
                        className="w-5 h-5 text-white" 
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                        <span className="font-bold text-sm truncate">{stat.categoryName}</span>
                        <span className="text-xs font-medium opacity-90">
                            {Math.round(stat.percentage)}%
                        </span>
                    </div>
                    <div className="flex justify-between items-end text-xs opacity-80">
                        <span>{stat.spent.toLocaleString()}원 사용</span>
                        <span>/ {stat.amount.toLocaleString()}원</span>
                    </div>
                </div>
            </div>
            
            {/* 게이지 바 */}
            <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, stat.percentage)}%` }}
                    className={cn("h-full rounded-full", getProgressColor(stat.status))}
                />
            </div>
        </div>
    );
}
