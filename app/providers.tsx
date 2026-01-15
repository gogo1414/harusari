'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { UserSettingsProvider } from '@/app/context/UserSettingsContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <UserSettingsProvider>
          {children}
          <Toaster
            position="top-center"
            expand={false}
            richColors
            closeButton
            toastOptions={{
              className: 'font-sans rounded-2xl',
              duration: 3000,
            }}
          />
        </UserSettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
