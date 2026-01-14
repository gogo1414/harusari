'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronLeft, Repeat as RepeatIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import type { Category } from '@/types/database';
import { CategoryIcon } from './IconPicker';

interface TransactionFormProps {
  categories: Category[];
  onSubmit: (data: any) => Promise<void>;
  initialDate?: Date;
}

export default function TransactionForm({ categories, onSubmit, initialDate }: TransactionFormProps) {
  const router = useRouter();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState<Date>(initialDate || new Date());
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 고정 지출 옵션
  const [endType, setEndType] = useState<'never' | 'date'>('never');
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // initialDate 변경 시 state 업데이트 (useEffect 필요)
  useEffect(() => {
    if (initialDate) {
      setDate(initialDate);
    }
  }, [initialDate]);

  const filteredCategories = categories.filter((c) => c.type === type);

  // 금액 포맷팅 (콤마 추가)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value) {
      setAmount(Number(value).toLocaleString());
    } else {
      setAmount('');
    }
  };

  const getRawAmount = () => {
    return amount ? parseInt(amount.replace(/,/g, ''), 10) : 0;
  };

  const handleSubmit = async () => {
    if (!amount || !categoryId) return;

    setIsLoading(true);
    try {
      await onSubmit({
        type,
        date,
        amount: getRawAmount(),
        category_id: categoryId,
        memo,
        is_recurring: isRecurring,
        end_type: endType,
        end_date: endDate,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-md">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <span className="text-lg font-bold">새로운 내역</span>
        <div className="w-9" /> {/* 공간 채우기용 */}
      </div>

      <div className="flex-1 px-4 py-2 space-y-6">
        {/* 수입/지출 선택 */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1">
          <button
            onClick={() => {
              setType('expense');
              setCategoryId(null);
            }}
            className={cn(
              "rounded-lg py-2.5 text-sm font-semibold transition-all",
              type === 'expense' 
                ? "bg-expense text-white shadow-sm" 
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            지출
          </button>
          <button
            onClick={() => {
              setType('income');
              setCategoryId(null);
            }}
            className={cn(
              "rounded-lg py-2.5 text-sm font-semibold transition-all",
              type === 'income' 
                ? "bg-income text-white shadow-sm" 
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            수입
          </button>
        </div>

        {/* 날짜 선택 */}
        <div className="flex justify-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-12 rounded-xl border-border/50 bg-card hover:bg-muted/30",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {date ? format(date, "yyyy년 M월 d일 (EEE)", { locale: ko }) : <span>날짜 선택</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 금액 입력 */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground ml-1 mb-1.5 block">금액</label>
          <div className="relative flex items-center rounded-2xl border border-border/50 bg-card px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20 transition-all">
            <input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              className="w-full flex-1 bg-transparent text-right text-3xl font-bold outline-none placeholder:text-muted-foreground/30"
              inputMode="numeric"
            />
            <span className="ml-2 text-xl font-bold text-foreground">
              원
            </span>
          </div>
        </div>

        {/* 카테고리 선택 */}
        <div>
           <label className="text-xs font-semibold text-muted-foreground ml-1 mb-2 block">카테고리</label>
           <div className="grid grid-cols-4 gap-3">
             {filteredCategories.map((cat) => (
               <button
                 key={cat.category_id}
                 onClick={() => setCategoryId(cat.category_id)}
                 className={cn(
                   "flex flex-col items-center gap-2 rounded-xl p-3 transition-all",
                   categoryId === cat.category_id 
                     ? "bg-primary/10 ring-2 ring-primary ring-inset" 
                     : "bg-card hover:bg-muted/50 border border-border/30"
                 )}
               >
                 <div className="relative">
                    <CategoryIcon 
                      iconName={cat.icon} 
                      className={cn(
                        "h-12 w-12 transition-transform", 
                        categoryId === cat.category_id && "scale-110 shadow-md"
                      )} 
                      variant="circle" 
                      showBackground={true} 
                    />
                    {categoryId === cat.category_id && (
                      <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-sm ring-2 ring-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </div>
                    )}
                 </div>
                 <span className={cn(
                   "text-[11px] font-medium truncate w-full text-center",
                   categoryId === cat.category_id ? "text-primary font-bold" : "text-muted-foreground"
                 )}>
                   {cat.name}
                 </span>
               </button>
             ))}
           </div>
        </div>

        {/* 메모 */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground ml-1 mb-1.5 block">메모</label>
          <Input 
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="내용을 입력하세요"
            className="h-12 rounded-xl bg-card border-border/50 text-base"
          />
        </div>

        {/* 고정 지출 설정 */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <RepeatIcon className="h-4 w-4" />
              </div>
              <div>
                <Label htmlFor="recurring" className="text-sm font-semibold">고정 내역으로 등록</Label>
                <p className="text-xs text-muted-foreground">매월 같은 날짜에 자동으로 기록됩니다</p>
              </div>
            </div>
            <Switch
              id="recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          {isRecurring && (
            <div className="pt-2 pl-2 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
               <div>
                 <Label className="text-xs text-muted-foreground mb-2 block">종료일 설정</Label>
                 <div className="flex gap-2">
                   <button
                     onClick={() => setEndType('never')}
                     className={cn(
                       "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                       endType === 'never' 
                         ? "border-primary bg-primary/5 text-primary" 
                         : "border-border bg-background text-muted-foreground"
                     )}
                   >
                     계속 반복
                   </button>
                   <button
                    onClick={() => setEndType('date')}
                     className={cn(
                       "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                       endType === 'date' 
                         ? "border-primary bg-primary/5 text-primary" 
                         : "border-border bg-background text-muted-foreground"
                     )}
                   >
                     날짜 지정
                   </button>
                 </div>
               </div>

               {endType === 'date' && (
                 <div className="animate-in fade-in">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "yyyy년 M월 d일", { locale: ko }) : <span>종료일 선택</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-background/80 backdrop-blur-sm sticky bottom-0">
        <Button 
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-soft" 
          size="lg"
          onClick={handleSubmit}
          disabled={!amount || !categoryId || isLoading}
        >
          {isLoading ? (
             <span className="flex items-center gap-2">저장 중...</span>
          ) : (
             <span className="flex items-center gap-2">
               <Check className="w-5 h-5" /> 저장하기
             </span>
          )}
        </Button>
      </div>
    </div>
  );
}
