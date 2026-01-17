/**
 * 공통 스타일 상수
 * 자주 사용되는 Tailwind 클래스 조합을 상수로 정의
 */

// 카드 기본 스타일
export const CARD_BASE = 'rounded-[24px] bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10';
export const CARD_ROUNDED_32 = 'rounded-[32px] bg-card shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10';

// 헤더 스타일
export const STICKY_HEADER = 'sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-sm px-4 py-3 border-b border-border/30';

// 입력 필드 스타일
export const INPUT_BASE = 'h-14 rounded-2xl bg-muted/30 border-none text-lg px-5 focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-background transition-all';

// 라벨 스타일
export const LABEL_SMALL = 'text-[13px] font-bold text-muted-foreground';

// 버튼 스타일
export const BUTTON_SUBMIT = 'w-full h-14 rounded-2xl text-lg font-bold shadow-lg transition-all active:scale-[0.98]';

// 팝오버 스타일
export const POPOVER_CONTENT = 'w-auto p-0 rounded-2xl shadow-xl border-none';

// 아이콘 버튼 스타일
export const ICON_BUTTON_GHOST = 'h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 active:opacity-70 transition-colors';

// 선택 버튼 스타일
export const SELECT_TRIGGER = 'h-12 rounded-xl border-border bg-background text-base font-medium';

// 요약 카드 내부 스타일
export const SUMMARY_BADGE = 'absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity';
