'use client';

import { cn } from '@/lib/utils';
import CategoryChart, { ChartData } from './CategoryChart';
import { CategoryIcon } from './IconPicker';

// Re-export shared interface to avoid breaking changes if possible
export type StatData = ChartData;

interface StatSectionProps {
  title: string;
  stats: StatData[];
  total: number;
  type: 'income' | 'expense';
  diffAmount?: number;
}

export default function StatSection({ title, stats, total, type }: StatSectionProps) {
  const isIncome = type === 'income';

  return (
    <div className="flex flex-col gap-8">
      {/* 바 차트 섹션 (아이폰 스토리지 스타일) */}
      <div className="flex flex-col gap-2">
         <CategoryChart 
            stats={stats} 
            total={total} 
            type="bar" 
            isIncome={isIncome}
         />
      </div>

      {/* 랭킹 리스트 섹션 (분리형 Progress Bar) */}
      <div className="flex flex-col gap-4">
        {stats.map((stat, index) => {
          const percentage = total > 0 ? (stat.amount / total) * 100 : 0;
          return (
            <div key={index} className="flex flex-col gap-2 p-1">
              {/* 상단: 아이콘 + 이름 + 금액 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CategoryIcon 
                    iconName={stat.icon} 
                    variant="squircle" 
                    className="h-10 w-10 text-xl"
                    showBackground={true}
                  />
                  <div className="flex flex-col">
                    <span className="text-[15px] font-bold tracking-tight text-foreground">{stat.name}</span>
                    <span className="text-xs text-muted-foreground font-medium tabular-nums">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <span className="text-[15px] font-bold tabular-nums text-foreground">
                  {new Intl.NumberFormat('ko-KR').format(stat.amount)}원
                </span>
              </div>

               {/* 하단: 프로그레스 바 */}
               <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${percentage}%`, backgroundColor: stat.color }}
                />
              </div>
            </div>
          );
        })}
        {stats.length === 0 && (
          <div className="text-center text-muted-foreground py-8 text-sm bg-secondary/10 rounded-xl">
            아직 기록된 {isIncome ? '수입' : '지출'}이 없어요.
          </div>
        )}
      </div>
    </div>
  );
}
