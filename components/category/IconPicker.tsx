'use client';

import {
  Utensils, Coffee, Beer, Bus, Car, Home, Smartphone,
  ShoppingCart, Shirt, Gamepad2, Pill, Book, Landmark,
  Briefcase, Gift, Plane, Dog, Heart, Zap, Wrench,
  CreditCard, Music, DollarSign, Wallet,
  PiggyBank, TrendingUp, Scissors, Smile,
  type LucideIcon,
  type LucideProps
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// 사용할 아이콘 목록 (키: 저장될 문자열, 컴포넌트: 렌더링할 아이콘)
export const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  'food': Utensils,
  'cafe': Coffee,
  'alcohol': Beer,
  'transport': Bus,
  'car': Car,
  'home': Home,
  'phone': Smartphone,
  'shopping': ShoppingCart,
  'clothes': Shirt,
  'game': Gamepad2,
  'medical': Pill,
  'education': Book,
  'bank': Landmark,
  'salary': Briefcase,
  'gift': Gift,
  'travel': Plane,
  'pet': Dog,
  'love': Heart,
  'utility': Zap,
  'repair': Wrench,
  'card': CreditCard,
  'music': Music,
  'beauty': Scissors,
  'investment': TrendingUp,
  'savings': PiggyBank,
  'wallet': Wallet,
  'money': DollarSign,
  'smile': Smile,
};

interface IconPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconName: string) => void;
  currentIcon?: string;
}

export default function IconPicker({ isOpen, onClose, onSelect, currentIcon }: IconPickerProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">아이콘 선택</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-5 gap-3 p-4">
          {Object.entries(ICON_MAP).map(([name, Icon]) => (
            <Button
              key={name}
              variant="ghost"
              className={cn(
                "h-14 w-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all",
                currentIcon === name 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transform scale-105" 
                  : "bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                onSelect(name);
                onClose();
              }}
            >
              <Icon className="h-6 w-6" />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 색상 팔레트 (Toss/BankSalad style pastel colors)
const ICON_COLORS = [
  '#3182F6', // Toss Blue
  '#F04452', // Red
  '#33C7A2', // Mint
  '#FFB800', // Yellow
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#8D6E63', // Brown
  '#78909C', // Blue Grey
];

function getIconColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ICON_COLORS.length;
  return ICON_COLORS[index];
}

interface CategoryIconProps {
  iconName: string;
  className?: string;
  variant?: 'default' | 'circle' | 'squircle';
  showBackground?: boolean;
}

// 아이콘 렌더링 헬퍼 컴포넌트
export function CategoryIcon({ iconName, className, variant = 'default', showBackground = false }: CategoryIconProps) {
  const Icon = ICON_MAP[iconName];
  const color = getIconColor(iconName);
  
  // LucideIcon 타입 호환성 문제 해결
  const LucideIcon = Icon as LucideIcon;

  const iconContent = Icon ? (
    <LucideIcon className={cn("h-full w-full", className)} strokeWidth={2.5} aria-hidden="true" />
  ) : (
    /\p{Emoji}/u.test(iconName) ? (
      <span className={cn("text-xl leading-none flex items-center justify-center h-full w-full", className)} role="img" aria-label={iconName}>{iconName}</span>
    ) : (
      <DollarSign className={cn("h-full w-full", className)} strokeWidth={2.5} aria-hidden="true" />
    )
  );

  if (showBackground || variant !== 'default') {
    const shapeClass = variant === 'circle' ? 'rounded-full' : 'rounded-2xl';
    
    return (
      <div 
        className={cn("flex items-center justify-center overflow-hidden shrink-0", shapeClass, className)}
        style={{ 
          backgroundColor: `${color}20`, // 20% opacity background
          color: color,
        }}
      >
        <div className="flex items-center justify-center w-[60%] h-[60%]">
           {iconContent}
        </div>
      </div>
    );
  }

  // 배경이 없을 때도 색상은 적용 (선택적)
  return (
    <div className={cn("flex items-center justify-center", className)} style={{ color }}>
      {iconContent}
    </div>
  );
}
