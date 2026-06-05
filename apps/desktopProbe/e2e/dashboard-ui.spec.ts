import { expect, test } from '@playwright/test';

test.describe('Dashboard UI contract', () => {
  test('shows dense jobs table structure with company logos', async ({ page }) => {
    await page.goto('/dashboard-contract.html');
    await expect(page.getByTestId('page-title')).toHaveText('Jobs');
    await expect(page.getByTestId('job-status-seg')).toBeVisible();
    await expect(page.getByTestId('jobs-table')).toBeVisible();
    await expect(page.getByTestId('job-row')).toContainText('Northstar Labs');
    await expect(page.locator('.co-logo img')).toHaveAttribute('src', /clearbit/);
  });

  test('uses compact segmented status tabs instead of full-width bar', async ({ page }) => {
    await page.goto('/dashboard-contract.html');
    await expect(page.getByTestId('job-status-seg').locator('button.active')).toHaveText('New 18');
    await expect(page.getByTestId('job-status-seg').locator('button')).toHaveCount(4);
  });

  test('includes compact settings panel', async ({ page }) => {
    await page.goto('/dashboard-contract.html');
    await expect(page.getByTestId('settings-panel')).toContainText('PRO');
  });
});
