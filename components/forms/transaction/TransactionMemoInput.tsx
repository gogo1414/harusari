import { Input } from '@/components/ui/input';

interface TransactionMemoInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function TransactionMemoInput({
  value,
  onChange,
}: TransactionMemoInputProps) {
  return (
    <div>
      <label className="text-[13px] font-bold text-muted-foreground ml-1 mb-2 block">메모</label>
      <Input 
        value={value}
        onChange={onChange}
        placeholder="어떤 내역인가요?"
        className="h-14 rounded-2xl bg-muted/30 border-none text-lg px-5 focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background transition-all"
      />
    </div>
  );
}
