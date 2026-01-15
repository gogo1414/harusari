'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronLeft, Repeat as RepeatIcon, Loader2 } from 'lucide-react';
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

export interface TransactionFormData {
  type: 'income' | 'expense';
  date: Date;
  amount: number;
  category_id: string;
  memo: string;
  is_recurring: boolean;
  end_type: 'never' | 'date';
  end_date?: Date;
}

interface TransactionFormProps {
  categories: Category[];
  onSubmit: (data: TransactionFormData) => Promise<void>;
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
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-sm px-4 py-3 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 rounded-full h-10 w-10 hover:bg-black/5 dark:hover:bg-white/10">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <span className="text-lg font-bold">새로운 내역</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-5 py-2 space-y-8">
        {/* 수입/지출 선택 */}
        <div className="flex justify-center">
            <div className="grid grid-cols-2 gap-0 rounded-[20px] bg-muted/60 p-1.5 w-full max-w-[280px]">
              <button
                onClick={() => {
                  setType('expense');
                  setCategoryId(null);
                }}
                className={cn(
                  "rounded-2xl py-2.5 text-sm font-bold transition-all duration-300",
                  type === 'expense' 
                    ? "bg-white dark:bg-card text-expense shadow-sm" 
                    : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
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
                  "rounded-2xl py-2.5 text-sm font-bold transition-all duration-300",
                  type === 'income' 
                    ? "bg-white dark:bg-card text-income shadow-sm" 
                    : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                수입
              </button>
            </div>
        </div>

        {/* 날짜 선택 */}
        <div className="flex justify-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-auto py-2 px-4 rounded-full bg-muted/30 hover:bg-muted/50 text-foreground font-medium text-base",
                  !date && "text-muted-foreground"
                )}
              >
                {date ? format(date, "M월 d일 (EEE)", { locale: ko }) : <span>날짜 선택</span>}
                <CalendarIcon className="ml-2 h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-none" align="center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className="rounded-2xl"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 금액 입력 */}
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center w-full">
            <input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              className={cn(
                  "w-full bg-transparent text-center text-5xl font-extrabold outline-none placeholder:text-muted-foreground/20 caret-primary",
                  type === 'income' ? "text-income" : "text-expense"
              )}
              inputMode="numeric"
              autoFocus
            />
          </div>
          <span className="mt-2 text-lg font-bold text-muted-foreground">원</span>
        </div>

        {/* 카테고리 선택 */}
        <div>
           <label className="text-[13px] font-bold text-muted-foreground ml-1 mb-3 block">카테고리</label>
           <div className="grid grid-cols-4 gap-x-2 gap-y-4">
             {filteredCategories.map((cat) => (
               <button
                 key={cat.category_id}
                 onClick={() => setCategoryId(cat.category_id)}
                 className="flex flex-col items-center gap-2 group"
               >
                 <div className="relative transition-transform active:scale-95 duration-200">
                    <CategoryIcon 
                      iconName={cat.icon} 
                      className={cn(
                        "h-14 w-14 transition-all duration-300", 
                        categoryId === cat.category_id 
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-105" 
                            : "opacity-80 group-hover:opacity-100"
                      )} 
                      variant="circle" 
                      showBackground={true} 
                    />
                    {categoryId === cat.category_id && (
                      <div className="absolute -right-0 -bottom-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow ring-2 ring-background animate-in zoom-in">
                        <Check className="h-3 w-3" strokeWidth={4} />
                      </div>
                    )}
                 </div>
                 <span className={cn(
                   "text-[12px] font-medium truncate w-full text-center transition-colors",
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
          <label className="text-[13px] font-bold text-muted-foreground ml-1 mb-2 block">메모</label>
          <Input 
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="어떤 내역인가요?"
            className="h-14 rounded-2xl bg-muted/30 border-none text-lg px-5 focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background transition-all"
          />
        </div>

        {/* 고정 지출 설정 */}
        <div className={cn(
          "rounded-2xl p-5 space-y-4 transition-all duration-300 bg-card shadow-md",
          isRecurring 
            ? "ring-2 ring-primary shadow-lg shadow-primary/20" 
            : "ring-1 ring-border/80"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300",
                isRecurring 
                  ? "bg-primary text-white shadow-lg shadow-primary/30" 
                  : "bg-secondary text-primary"
              )}>
                <RepeatIcon className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="recurring" className="text-base font-bold cursor-pointer">반복 설정</Label>
                <p className="text-xs text-muted-foreground font-medium">매월 자동으로 기록할까요?</p>
              </div>
            </div>
            <Switch
              id="recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-secondary scale-110"
            />
          </div>

          {isRecurring && (
            <div className="pt-2 pl-1 space-y-4 animate-in slide-in-from-top-2 fade-in duration-300">
               <div className="bg-background rounded-2xl p-4 shadow-sm">
                 <Label className="text-xs text-muted-foreground mb-3 block font-bold">종료일</Label>
                 <div className="flex gap-2">
                   <button
                     onClick={() => setEndType('never')}
                     className={cn(
                       "flex-1 rounded-xl py-3 text-sm font-bold transition-all",
                       endType === 'never' 
                         ? "bg-primary/10 text-primary ring-1 ring-primary/20" 
                         : "bg-muted/50 text-muted-foreground hover:bg-muted"
                     )}
                   >
                     계속 반복
                   </button>
                   <button
                    onClick={() => setEndType('date')}
                     className={cn(
                       "flex-1 rounded-xl py-3 text-sm font-bold transition-all",
                       endType === 'date' 
                         ? "bg-primary/10 text-primary ring-1 ring-primary/20" 
                         : "bg-muted/50 text-muted-foreground hover:bg-muted"
                     )}
                   >
                     날짜 지정
                   </button>
                 </div>

                 {endType === 'date' && (
                   <div className="mt-3 animate-in fade-in pt-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-center font-medium h-12 rounded-xl bg-muted/30 border-none hover:bg-muted/50",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                            {endDate ? format(endDate, "yyyy년 M월 d일", { locale: ko }) : <span>종료일 선택</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-none" align="center">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className="rounded-2xl"
                          />
                        </PopoverContent>
                      </Popover>
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-background/80 backdrop-blur-md sticky bottom-0 z-20">
        <Button 
          className={cn(
              "w-full h-14 rounded-2xl text-lg font-bold shadow-lg transition-all active:scale-[0.98]",
              type === 'income' ? "shadow-income/20 hover:bg-income/90 bg-income" : "shadow-expense/20 hover:bg-expense/90 bg-expense"
          )}
          size="lg"
          onClick={handleSubmit}
          disabled={!amount || !categoryId || isLoading}
        >
          {isLoading ? (
             <span className="flex items-center gap-2">
                 <Loader2 className="animate-spin h-5 w-5" /> 저장 중...
             </span>
          ) : (
             <span className="flex items-center gap-2">
               <Check className="w-6 h-6" strokeWidth={3} /> 
               {amount ? `${amount}원 저장` : '저장하기'}
             </span>
          )}
        </Button>
      </div>
    </div>
  );
}
