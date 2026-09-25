
'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';


export interface ChartData {
  name: string;
  amount: number;
  icon: string;
  color: string;
  // Recharts Pie 컴포넌트 호환을 위한 인덱스 시그니처
  [key: string]: string | number;
}

interface CategoryChartProps {
  stats: ChartData[];
  total: number;
  type: 'donut' | 'bar';
  isIncome?: boolean;
}

export default function CategoryChart({ stats, total, type, isIncome }: CategoryChartProps) {
  if (type === 'donut') {
    return (
      <div className="flex flex-col items-center justify-center relative">
        {stats.length > 0 ? (
          <div className="relative w-56 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="amount"
                  cornerRadius={8}
                  stroke="none"
                >
                  {stats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                   formatter={(value) => new Intl.NumberFormat('ko-KR').format(Number(value) || 0) + '원'}
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                 />
              </PieChart>
            </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-4xl filter grayscale opacity-30 mb-1">
                 {isIncome ? '💰' : '💸'}
               </span>
               <span className="text-sm font-medium text-muted-foreground/50">
                 {isIncome ? '수입' : '지출'}
               </span>
             </div>
          </div>
        ) : (
           <div className="flex flex-col items-center justify-center h-56 w-56 rounded-full bg-secondary/10 border-4 border-dashed border-secondary/20">
             <span className="text-4xl opacity-20 grayscale">📊</span>
             <span className="text-xs text-muted-foreground mt-2">내역 없음</span>
           </div>
        )}
      </div>
    );
  }

  // Linear Stacked Bar (iPhone Storage Style)
  if (type === 'bar') {
    if (stats.length === 0) {
      return (
        <div className="h-12 w-full bg-secondary/10 rounded-xl border border-dashed border-secondary/20 flex items-center justify-center text-muted-foreground text-sm">
          내역 없음
        </div>
      );
    }

    // 항목이 하나뿐이면 비율 막대가 의미 없는 통짜 블록이 되므로 생략 (아래 목록에 100%로 표시됨)
    if (stats.length === 1) return null;

    return (
      <div className="w-full flex h-12 rounded-xl overflow-hidden ring-1 ring-black/5">
        {stats.map((stat, index) => {
          const percentage = (stat.amount / total) * 100;
          // Don't render very small segments to avoid rendering issues, or min-width?
          if (percentage < 1 && index < stats.length - 1) return null; 
          
          return (
            <div
              key={index}
              className="h-full first:pl-1 last:pr-1 transition-all hover:opacity-80 relative group"
              style={{ width: `${percentage}%`, backgroundColor: stat.color }}
              title={`${stat.name}: ${percentage.toFixed(1)}%`}
            >
              {/* Optional: Add a separator line or gap? */}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
