import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

interface InstallmentHeaderProps {
  isEditMode: boolean;
  onCancel: () => void;
}

export default function InstallmentHeader({ isEditMode, onCancel }: InstallmentHeaderProps) {
  return (
    <div className="flex items-center gap-3 p-4 border-b">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="h-10 w-10 -ml-2 rounded-full hover:bg-muted"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <h1 className="text-xl font-bold">{isEditMode ? '할부 수정' : '할부 등록'}</h1>
    </div>
  );
}
