import { test, expect } from '@playwright/test';

test.describe('App Main Page', () => {
  test('should redirect to login page when not authenticated', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Should receive a redirect to /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should protect other private routes', async ({ page }) => {
    const protectedRoutes = ['/stats', '/settings', '/categories'];
    
    for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');

    // Check for Login Page elements
    await expect(page.getByText('오늘 벌어 오늘 사는')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Google로 계속하기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '카카오로 계속하기' })).toBeVisible();
    
    // Check footer
    await expect(page.getByText('이용약관 및 개인정보처리방침')).toBeVisible();
  });
});
