
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface TrendData {
  name: string;
  income: number;
  expense: number;
  incomeLabel: string;
  expenseLabel: string;
}

interface TrendChartProps {
  data: TrendData[];
}

export default function TrendChart({ data }: TrendChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatBarLabel = (value: any) => {
    const num = Number(value);
    if (isNaN(num) || num === 0) return '';
    if (num >= 10000) return `${(num / 10000).toFixed(1)}만`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}천`;
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const hasData = data.some(item => item.income > 0 || item.expense > 0);

  return (
    <div className="h-[320px] w-full relative">
      {!hasData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-[1px] z-10 rounded-[32px]">
          <span className="text-4xl grayscale opacity-30 mb-2">📊</span>
          <span className="text-sm text-muted-foreground font-medium">내역 없음</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#888' }} 
            dy={8}
            interval={0}
          />
          <Tooltip 
            formatter={(value: number) => new Intl.NumberFormat('ko-KR').format(value || 0) + '원'}
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', padding: '12px 16px' }}
            itemStyle={{ fontWeight: 'bold' }}
            cursor={{ fill: 'rgba(0,0,0,0.03)', radius: 8 }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
          <Bar 
            dataKey="income" 
            name="수입" 
            fill="#3182F6" 
            radius={[4, 4, 4, 4]} 
            barSize={12}
            label={{ position: 'top', formatter: formatBarLabel, fontSize: 10, fill: '#3182F6', dy: -5 }}
          />
          <Bar 
            dataKey="expense" 
            name="지출" 
            fill="#F04452" 
            radius={[4, 4, 4, 4]} 
            barSize={12}
            label={{ position: 'top', formatter: formatBarLabel, fontSize: 10, fill: '#F04452', dy: -5 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
