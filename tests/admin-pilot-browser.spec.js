import { test, expect, devices } from '@playwright/test';
import { createAdminToken } from '../lib/admin-auth.js';

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
test.use({ browserName: 'chromium', ...devices['iPhone 13'] });

test('pilot management rejects anonymous browser sessions', async ({ page }) => {
  const response = await page.goto(BASE + '/admin/pilotlar');
  expect(response).not.toBeNull();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole('heading', { name: 'Ücretsiz pilot yönetimi' })).toHaveCount(0);
});

test('authorized mobile admin can view pilot controls without issuing any pilot grant', async ({ page, context }) => {
  test.skip(!process.env.ADMIN_PASSWORD || !process.env.AUTH_SECRET, 'local admin signing fixture required');
  await context.addCookies([{
    name: 'ai_admin', value: await createAdminToken(), url: BASE,
    httpOnly: true, secure: true, sameSite: 'Strict'
  }]);
  let mutationCount = 0;
  await page.route('**/api/admin-pilots', async route => {
    if (route.request().method() !== 'GET') {
      mutationCount++;
      return route.fulfill({ status: 403, json: { error: 'Writes prohibited in smoke tests' } });
    }
    return route.fulfill({ json: { clients: [{ id: 'local-zeratest', name: 'ZERA Test Fixture', pilot: null }] } });
  });
  await page.goto(BASE + '/admin/pilotlar');
  await expect(page.getByRole('heading', { name: 'Ücretsiz pilot yönetimi' })).toBeVisible();
  await expect(page.getByText('Ücretsiz işletme pilotu')).toBeVisible();
  await expect(page.getByRole('option', { name: 'ZERA Test Fixture' })).toBeAttached();
  expect(mutationCount).toBe(0);
});
