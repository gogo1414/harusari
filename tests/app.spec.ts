import { test, expect } from '@playwright/test';

test.describe('App Main Page', () => {
  test('should load the main page and display title', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Check for the title "하루살이"
    // Since we are checking for the header title inside the sheet trigger or main header
    // Use a locator that finds the text '하루살이' which is visible
    await expect(page.getByRole('heading', { name: '하루살이' })).toBeVisible();
  });

  test('should open navigation drawer when menu button is clicked', async ({ page }) => {
    await page.goto('/');
    
    // Click the menu button (hamburger icon)
    // It's a button with a Menu icon inside. We can look for the button testid if added, or by role
    const menuButton = page.locator('button').filter({ has: page.locator('svg.lucide-menu') });
    await menuButton.click();

    // Check if the sheet content is visible
    // The sheet title "하루살이" or navigation links should be visible
    await expect(page.getByRole('link', { name: '카테고리 관리' })).toBeVisible();
    await expect(page.getByRole('link', { name: '고정 지출/수입' })).toBeVisible();
  });
});
