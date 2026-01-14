import { test, expect } from '@playwright/test';

test.describe('App Main Page', () => {
  test('should redirect to login page when not authenticated', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Should receive a redirect to /login
    await expect(page).toHaveURL(/\/login/);

    // Check for Login Page elements
    await expect(page.getByText('오늘 벌어 오늘 사는')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Google로 계속하기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '카카오로 계속하기' })).toBeVisible();
  });

  // Test for navigation drawer is skipped until we implement auth mocking or test user login
  test.skip('should open navigation drawer when menu button is clicked', async ({ page }) => {
    // This test requires authentication state. 
    // TODO: Implement global setup for auth bypass or test user login
    await page.goto('/');
    
    // Click the menu button (hamburger icon) using accessible name
    const menuButton = page.getByLabel('메뉴 열기');
    await menuButton.click();

    // Check if the sheet content is visible
    // Wait for the sheet animation
    const sheetTitle = page.getByText('하루살이', { exact: true }).nth(1); 
    await expect(page.getByRole('link', { name: '카테고리 관리' })).toBeVisible();
    await expect(page.getByRole('link', { name: '고정 지출/수입' })).toBeVisible();
  });
});
