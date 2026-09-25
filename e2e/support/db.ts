import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

/** 로컬 Supabase 접속 정보 (supabase start 출력값) */
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY || '';

if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(SUPABASE_URL)) {
  // 실수로 운영 DB를 대상으로 테스트 데이터를 만들지 않도록 차단
  throw new Error(`E2E는 로컬 Supabase에서만 실행합니다: ${SUPABASE_URL}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Admin = SupabaseClient<any, any, any>;

export function adminClient(): Admin {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function createTestUser(admin: Admin, label: string): Promise<TestUser> {
  const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@harusari.test`;
  const password = 'e2e-Password-1234!';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  return { id: data.user.id, email, password };
}

/**
 * @supabase/ssr가 쓰는 형식 그대로 세션 쿠키를 만든다 (OAuth 로그인 화면을 거치지 않기 위함).
 */
export async function sessionCookies(user: TestUser) {
  const jar = new Map<string, { value: string }>();
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, { value }]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, { value })),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return [...jar.entries()]
    .filter(([, { value }]) => value)
    .map(([name, { value }]) => ({ name, value, domain: 'localhost', path: '/', sameSite: 'Lax' as const }));
}

export async function setPayday(admin: Admin, userId: string, day: number) {
  const { error } = await admin
    .from('user_settings')
    .upsert({ user_id: userId, cycle_start_day: day }, { onConflict: 'user_id' });
  if (error) throw error;
}

export const DEFAULT_TEST_CATEGORIES = [
  { name: '식비', type: 'expense', icon: 'utensils' },
  { name: '카페', type: 'expense', icon: 'coffee' },
  { name: '교통', type: 'expense', icon: 'bus' },
  { name: '쇼핑', type: 'expense', icon: 'shopping-bag' },
  { name: '주거/통신', type: 'expense', icon: 'home' },
  { name: '저축', type: 'expense', icon: 'piggy-bank', is_savings: true },
  { name: '급여', type: 'income', icon: 'wallet' },
  { name: '부수입', type: 'income', icon: 'coins' },
] as const;

/** 카테고리를 직접 만들고 name → id 맵을 돌려준다 */
export async function seedCategories(admin: Admin, userId: string) {
  // 배열 insert는 키 합집합 기준이라 빠진 키가 NULL이 된다 → 모든 행에 is_savings를 명시
  const rows = DEFAULT_TEST_CATEGORIES.map((c, i) => ({ user_id: userId, sort_order: i, is_savings: false, ...c }));
  const { data, error } = await admin.from('categories').insert(rows).select('category_id, name, type');
  if (error) throw error;
  return new Map((data as { category_id: string; name: string }[]).map((c) => [c.name, c.category_id]));
}

export async function transactionsOf(admin: Admin, userId: string) {
  const { data, error } = await admin
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date')
    .order('created_at');
  if (error) throw error;
  return data as Array<Record<string, unknown> & { date: string; amount: number; memo: string | null }>;
}
