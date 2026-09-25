import { redirect } from 'next/navigation';

/**
 * 예전 빠른 입력 주소. 입력 화면이 하나로 합쳐져 /transactions/new?mode=quick 으로 보낸다.
 */
export default async function QuickAddRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const date = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  redirect(`/transactions/new?mode=quick${date ? `&date=${date}` : ''}`);
}
