import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Cron 작업용 Admin 클라이언트 (RLS 우회)
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}
