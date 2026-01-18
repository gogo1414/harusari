'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/category/IconPicker';

export type BudgetAnalysisItem = {
    category_id: string | null;
    categoryName: string;
    categoryIcon: string;
    goal: number;
    spent: number;
    percentage: number;
    status: 'safe' | 'warning' | 'danger';
};

interface BudgetAnalysisCardProps {
    data: BudgetAnalysisItem[];
}

export default function BudgetAnalysisCard({ data }: BudgetAnalysisCardProps) {
    const router = useRouter();

    return (
        <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 bg-card rounded-[32px] p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-border/60 hover:shadow-lg transition-shadow duration-300">
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-500">
                    <span className="text-lg">🎯</span>
                </div>
                <div>
                    <h3 className="text-xl font-bold tracking-tight">예산 분석</h3>
                    <p className="text-sm text-muted-foreground">이번 달 목표 대비 지출 현황</p>
                </div>
             </div>
           </div>

           {/* 예산 데이터가 있을 때만 표시 */}
           {data.length > 0 ? (
               <div className="space-y-6">
                   {data.map((item) => (
                       <div key={item.category_id} className="space-y-2">
                           <div className="flex justify-between items-center text-sm">
                               <div className="flex items-center gap-2">
                                   <div className="w-6 h-6 rounded-full bg-secondary/80 flex items-center justify-center p-1">
                                       <CategoryIcon iconName={item.categoryIcon} className="w-3.5 h-3.5" />
                                   </div>
                                   <span className="font-bold">{item.categoryName}</span>
                                   {/* 상태 뱃지 */}
                                   <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                       item.status === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                                       item.status === 'warning' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' :
                                       'bg-green-100 text-green-600 dark:bg-green-900/30'
                                   }`}>
                                       {item.status === 'danger' ? '예산 초과' :
                                        item.status === 'warning' ? '주의' : '잘하고 있어요'}
                                   </span>
                               </div>
                               <div className="flex items-end gap-1">
                                   <span className="font-bold tabular-nums">
                                    {Math.round(item.percentage)}%
                                   </span>
                                   <span className="text-xs text-muted-foreground mb-0.5">
                                    ({item.spent.toLocaleString()} / {item.goal.toLocaleString()})
                                   </span>
                               </div>
                           </div>
                           
                           {/* Progress Bar */}
                           <div className="h-3 w-full bg-secondary/50 rounded-full overflow-hidden">
                               <div 
                                   className={`h-full rounded-full transition-all duration-500 ${
                                       item.status === 'danger' ? 'bg-red-500' :
                                       item.status === 'warning' ? 'bg-orange-500' :
                                       'bg-emerald-500'
                                   }`}
                                   style={{ width: `${Math.min(100, item.percentage)}%` }}
                               />
                           </div>
                       </div>
                   ))}
               </div>
           ) : (
               <div className="text-center py-8 text-muted-foreground">
                   <p>설정된 예산 목표가 없습니다.</p>
                   <Button 
                    variant="link" 
                    onClick={() => router.push('/budget-settings')}
                    className="mt-2 text-primary"
                   >
                    예산 설정하러 가기
                   </Button>
               </div>
           )}
        </div>
    );
}
