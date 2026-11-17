import { test, expect, devices } from '@playwright/test';

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001';
test.use({ browserName: 'chromium', ...devices['iPhone 13'] });

test('Preview without isolated database displays a safety notice, not a password form', async ({page}) => {
  const response = await page.goto(BASE + '/login');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', {name: 'Önizleme: yönetici girişi kapalı'})).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole('link', {name: 'Canlı yönetici girişine git'}))
    .toHaveAttribute('href', 'https://www.aivisibilityworks.com/login');
});

test('Preview pilot management denies unauthenticated browser access', async ({page}) => {
  await page.goto(BASE + '/admin/pilotlar');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole('heading', {name: 'Önizleme: yönetici girişi kapalı'})).toBeVisible();
});

test('Preview pilot API cannot enumerate real customers without admin', async ({request}) => {
  const response = await request.get(BASE + '/api/admin-pilots');
  expect(response.status()).toBe(401);
  const payload = await response.json();
  expect(payload.clients).toBeUndefined();
});
