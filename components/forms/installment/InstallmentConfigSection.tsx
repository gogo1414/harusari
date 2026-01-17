import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InstallmentConfigSectionProps {
  months: number;
  annualRate: number;
  interestFreeMonths: number;
  onMonthsChange: (months: number) => void;
  onAnnualRateChange: (rate: number) => void;
  onInterestFreeMonthsChange: (months: number) => void;
}

const MONTH_OPTIONS = [2, 3, 4, 5, 6, 9, 10, 12, 18, 24, 36, 48, 60];

export default function InstallmentConfigSection({
  months,
  annualRate,
  interestFreeMonths,
  onMonthsChange,
  onAnnualRateChange,
  onInterestFreeMonthsChange,
}: InstallmentConfigSectionProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">할부 기간</label>
          <Select
            value={months.toString()}
            onValueChange={(val) => onMonthsChange(parseInt(val))}
          >
            <SelectTrigger className="h-12 rounded-xl border-border bg-card text-lg font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map(m => (
                <SelectItem key={m} value={m.toString()}>{m}개월</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">연 이자율 (%)</label>
          <div className="relative">
            <input
              type="number"
              value={annualRate}
              onChange={(e) => onAnnualRateChange(parseFloat(e.target.value) || 0)}
              className="flex h-12 w-full rounded-xl border border-input bg-card px-3 py-2 text-lg font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-right pr-8"
              placeholder="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">무이자 적용 (선택)</label>
          <Select
            value={interestFreeMonths.toString()}
            onValueChange={(val) => onInterestFreeMonthsChange(parseInt(val))}
          >
            <SelectTrigger className="h-12 rounded-xl border-border bg-card text-base text-muted-foreground font-medium">
              <SelectValue placeholder="무이자 없음" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">무이자 없음 (전체 유이자)</SelectItem>
              {Array.from({ length: months }, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()}>{m === months ? '전액 무이자' : `${m}개월 무이자`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>
    </>
  );
}
