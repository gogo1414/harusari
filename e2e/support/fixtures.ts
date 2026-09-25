import { test as base, expect, type Page } from '@playwright/test';
import { adminClient, createTestUser, sessionCookies, type Admin, type TestUser } from './db';

/** KST 기준 오늘 yyyy-MM-dd */
export function kstToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
}

type Fixtures = {
  admin: Admin;
  user: TestUser;
  /** 로그인 쿠키가 심어진 페이지 */
  authedPage: Page;
};

export const test = base.extend<Fixtures>({
  admin: async ({}, provide) => {
    await provide(adminClient());
  },
  user: async ({ admin }, provide, testInfo) => {
    const user = await createTestUser(admin, testInfo.title.replace(/[^a-z0-9]+/gi, '').slice(0, 12) || 'u');
    await provide(user);
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
  },
  authedPage: async ({ page, context, user }, provide) => {
    await context.addCookies(await sessionCookies(user));
    await provide(page);
  },
});

export { expect };
