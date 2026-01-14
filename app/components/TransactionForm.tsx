'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { Category } from '@/types/database';
import { useRouter } from 'next/navigation';

interface TransactionFormProps {
  categories: Category[];
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
}

export default function TransactionForm({
  categories,
  onSubmit,
  initialData,
}: TransactionFormProps) {
  const router = useRouter();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [memo, setMemo] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endType, setEndType] = useState<'never' | 'date'>('never');

  const filteredCategories = categories.filter((c) => c.type === type);

  // 금액 입력 핸들러 (콤마 자동 포맷팅)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value === '') {
      setAmount('');
      return;
    }
    const numberValue = parseInt(value, 10);
    setAmount(new Intl.NumberFormat('ko-KR').format(numberValue));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !selectedCategoryId) return;

    const numericAmount = parseInt(amount.replace(/,/g, ''), 10);

    await onSubmit({
      type,
      date,
      amount: numericAmount,
      category_id: selectedCategoryId,
      memo,
      is_recurring: isRecurring,
      end_type: isRecurring ? endType : undefined,
      end_date: isRecurring && endType === 'date' ? endDate : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-4">
      {/* 상단 네비게이션 & 유형 선택 */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Tabs
          value={type}
          onValueChange={(v) => {
            setType(v as 'expense' | 'income');
            setSelectedCategoryId(null);
          }}
          className="w-[200px]"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              value="expense"
              className="data-[state=active]:bg-expense data-[state=active]:text-white"
            >
              지출
            </TabsTrigger>
            <TabsTrigger
              value="income"
              className="data-[state=active]:bg-income data-[state=active]:text-white"
            >
              수입
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* 날짜 선택 */}
      <div className="flex justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[240px] justify-start text-left font-normal',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? (
                format(date, 'yyyy년 M월 d일 (EEE)', { locale: ko })
              ) : (
                <span>날짜 선택</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              locale={ko}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* 금액 입력 */}
      <div className="text-center">
        <Input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={handleAmountChange}
          placeholder="0"
          className={`h-16 border-none text-center text-4xl font-bold shadow-none focus-visible:ring-0 ${
            type === 'income'
              ? 'text-income placeholder:text-income/30'
              : 'text-expense placeholder:text-expense/30'
          }`}
        />
        <span className="text-muted-foreground">원</span>
      </div>

      {/* 카테고리 그리드 */}
      <div className="grid grid-cols-4 gap-4">
        {filteredCategories.map((category) => (
          <button
            key={category.category_id}
            type="button"
            onClick={() => setSelectedCategoryId(category.category_id)}
            className={`flex flex-col items-center gap-2 rounded-xl p-3 transition-all ${
              selectedCategoryId === category.category_id
                ? 'bg-primary/10 ring-2 ring-primary'
                : 'hover:bg-muted'
            }`}
          >
            <span className="text-3xl">{category.icon}</span>
            <span className="text-xs font-medium">{category.name}</span>
          </button>
        ))}
        {/* 카테고리 추가 버튼 (추후 구현) */}
      </div>

      {/* 메모 */}
      <div className="space-y-2">
        <Label htmlFor="memo">메모</Label>
        <Input
          id="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="내용을 입력하세요"
        />
      </div>

      {/* 고정 등록 옵션 */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="recurring"
            checked={isRecurring}
            onCheckedChange={(c) => setIsRecurring(!!c)}
          />
          <Label htmlFor="recurring" className="font-medium">
            이 내역을 고정 {type === 'income' ? '수입' : '지출'}으로 등록
          </Label>
        </div>

        {isRecurring && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="space-y-2">
              <Label>종료 조건</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={endType === 'never' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEndType('never')}
                  className="flex-1"
                >
                  계속 반복
                </Button>
                <Button
                  type="button"
                  variant={endType === 'date' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEndType('date')}
                  className="flex-1"
                >
                  날짜 지정
                </Button>
              </div>
            </div>

            {endType === 'date' && (
              <div className="space-y-2">
                <Label>종료일</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !endDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? (
                        format(endDate, 'yyyy년 M월 d일', { locale: ko })
                      ) : (
                        <span>종료일 선택</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      locale={ko}
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

      {/* 저장 버튼 */}
      <Button
        type="submit"
        className={`mt-4 h-12 text-lg font-bold ${
          type === 'income'
            ? 'bg-income hover:bg-income/90'
            : 'bg-expense hover:bg-expense/90'
        }`}
        disabled={!amount || !selectedCategoryId}
      >
        저장하기
      </Button>
    </form>
  );
}
