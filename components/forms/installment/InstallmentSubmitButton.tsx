import { Button } from '@/components/ui/button';

interface InstallmentSubmitButtonProps {
    isSubmitting: boolean;
    isEditMode: boolean;
    disabled: boolean;
}

export default function InstallmentSubmitButton({ isSubmitting, isEditMode, disabled }: InstallmentSubmitButtonProps) {
    return (
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-background/80 backdrop-blur-md border-t">
        <Button 
            type="submit" 
            className="w-full h-14 text-lg rounded-2xl font-bold shadow-lg shadow-primary/20" 
            disabled={disabled}
        >
          {isSubmitting ? (
             <span className="flex items-center gap-2">
               <span className="animate-spin text-xl">⏳</span> 저장 중...
             </span>
          ) : (
             isEditMode ? '할부 수정하기' : '할부 등록하기'
          )}
        </Button>
      </div>
    );
}
