'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, List, Repeat, BarChart3, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedMenuIcon } from '@/components/animation/AnimatedMenuIcon';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { menuItemVariants } from '@/lib/styles/variants';

interface HomeHeaderProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  onLogout: () => void;
}

export default function HomeHeader({ isMenuOpen, setIsMenuOpen, onLogout }: HomeHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-background/80 px-6 py-4 backdrop-blur-xl border-b border-black/5 dark:border-white/5 transition-all">
      <div className="flex items-center gap-1">
         <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-3 h-11 w-11 rounded-full text-foreground/80 hover:bg-muted" aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}>
                 <AnimatedMenuIcon isOpen={isMenuOpen} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0 rounded-r-[32px] border-r-0 shadow-2xl">
               <SheetHeader className="p-8 text-left border-b border-border/50 bg-[#F9FAFB] dark:bg-muted/30">
                 <SheetTitle className="text-2xl font-extrabold text-primary flex items-center gap-2">
                   <span className="text-3xl">💸</span> 하루살이
                 </SheetTitle>
                 <p className="text-sm text-muted-foreground mt-1 font-medium">오늘 벌어 오늘 사는 1인 가계부</p>
               </SheetHeader>

               <nav className="flex flex-col p-4 gap-2 mt-2" aria-label="주요 메뉴">
                  <AnimatePresence>
                    {isMenuOpen && (
                      <>
                        <motion.div custom={0} variants={menuItemVariants} initial="hidden" animate="visible">
                          <Link href="/categories" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 rounded-2xl p-4 transition-all group active:scale-95 ${pathname === '/categories' ? 'bg-primary/10' : 'hover:bg-muted/80'}`}>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all ${pathname === '/categories' ? 'bg-primary/10 ring-primary/30' : 'bg-white ring-black/5 group-hover:ring-primary/20'}`}>
                               <List className={`h-6 w-6 ${pathname === '/categories' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} aria-hidden="true" />
                            </div>
                            <span className={`font-bold text-lg ${pathname === '/categories' ? 'text-primary' : 'text-foreground/90'}`}>카테고리 관리</span>
                          </Link>
                        </motion.div>

                        <motion.div custom={1} variants={menuItemVariants} initial="hidden" animate="visible">
                          <Link href="/recurring" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 rounded-2xl p-4 transition-all group active:scale-95 ${pathname === '/recurring' ? 'bg-primary/10' : 'hover:bg-muted/80'}`}>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all ${pathname === '/recurring' ? 'bg-primary/10 ring-primary/30' : 'bg-white ring-black/5 group-hover:ring-primary/20'}`}>
                               <Repeat className={`h-6 w-6 ${pathname === '/recurring' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} aria-hidden="true" />
                            </div>
                            <span className={`font-bold text-lg ${pathname === '/recurring' ? 'text-primary' : 'text-foreground/90'}`}>고정 지출/수입</span>
                          </Link>
                        </motion.div>

                        <motion.div custom={2} variants={menuItemVariants} initial="hidden" animate="visible">
                          <Link href="/stats" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 rounded-2xl p-4 transition-all group active:scale-95 ${pathname === '/stats' ? 'bg-primary/10' : 'hover:bg-muted/80'}`}>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all ${pathname === '/stats' ? 'bg-primary/10 ring-primary/30' : 'bg-white ring-black/5 group-hover:ring-primary/20'}`}>
                               <BarChart3 className={`h-6 w-6 ${pathname === '/stats' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} aria-hidden="true" />
                            </div>
                            <span className={`font-bold text-lg ${pathname === '/stats' ? 'text-primary' : 'text-foreground/90'}`}>지출 분석</span>
                          </Link>
                        </motion.div>

                        <motion.div custom={3} variants={menuItemVariants} initial="hidden" animate="visible">
                          <Link href="/settings" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-4 rounded-2xl p-4 transition-all group active:scale-95 ${pathname === '/settings' ? 'bg-primary/10' : 'hover:bg-muted/80'}`}>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1 transition-all ${pathname === '/settings' ? 'bg-primary/10 ring-primary/30' : 'bg-white ring-black/5 group-hover:ring-primary/20'}`}>
                               <Settings className={`h-6 w-6 ${pathname === '/settings' ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} aria-hidden="true" />
                            </div>
                            <span className={`font-bold text-lg ${pathname === '/settings' ? 'text-primary' : 'text-foreground/90'}`}>환경 설정</span>
                          </Link>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
               </nav>

               <div className="absolute bottom-8 left-0 right-0 px-6">
                  <Button
                    variant="ghost"
                    onClick={onLogout}
                    className="w-full justify-start gap-3 h-14 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 px-4"
                  >
                    <LogOut className="h-5 w-5" aria-hidden="true" />
                    <span className="font-semibold text-base">로그아웃</span>
                  </Button>
               </div>
            </SheetContent>
         </Sheet>
         
         <h1 className="text-xl font-extrabold tracking-tight text-foreground ml-1">
          하루살이
         </h1>
      </div>
      
      {/* 우측 빈 공간 (레이아웃 균형을 위해) */}
      <div className="w-10" />
    </header>
  );
}
