'use client';

import { MessageSquareText, PencilLine } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AddMode = 'quick' | 'manual';

export const ADD_MODE_STORAGE_KEY = 'harusari:add-mode';

export function readSavedAddMode(): AddMode | null {
  try {
    const v = window.localStorage.getItem(ADD_MODE_STORAGE_KEY);
    return v === 'quick' || v === 'manual' ? v : null;
  } catch {
    return null;
  }
}

export function saveAddMode(mode: AddMode) {
  try {
    window.localStorage.setItem(ADD_MODE_STORAGE_KEY, mode);
  } catch {
    // 저장 불가(사생활 보호 모드 등) → 이번 화면에서만 반영
  }
}

const OPTIONS: { value: AddMode; label: string; Icon: typeof PencilLine }[] = [
  { value: 'quick', label: '문장으로', Icon: MessageSquareText },
  { value: 'manual', label: '직접 입력', Icon: PencilLine },
];

/** 새 내역 입력 방식 전환 (헤더 가운데) */
export default function AddModeSwitch({ value, onChange }: { value: AddMode; onChange: (mode: AddMode) => void }) {
  return (
    <div role="radiogroup" aria-label="입력 방식" className="flex rounded-full bg-muted p-1 text-[13px] font-semibold">
      {OPTIONS.map(({ value: v, label, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !active && onChange(v)}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-full px-3.5 transition-colors',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
