import { test, expect } from '@playwright/test';

test('Tommy’s demo walk updates the daily goal and weekly report once', async ({ page }) => {
  await page.goto('/demo');
  const tour = page.locator('.walk-tour');
  const record = tour.getByRole('button', { name: 'Отметить прогулку' });
  await expect(tour.locator('dd')).toHaveText(['1 / 3', '16 / 21']);
  await tour.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(record).toBeHidden();
  await page.keyboard.press('Enter');
  await record.focus();
  await page.keyboard.press('Enter');
  await expect(tour.locator('dd')).toHaveText(['1 → 2 / 3', '16 → 17 / 21']);
  await expect(tour.getByRole('button', { name: 'Прогулка отмечена' })).toBeDisabled();
  await expect(page.locator('.goal-counter [role=status]')).toHaveText('2 из 3');
  await tour.getByRole('button', { name: 'Открыть недельный отчёт' }).click();
  await expect(page.getByTestId('week-walks')).toHaveText('17 / 21');
  await expect(page.locator('.weekly-header h3')).toBeFocused();
});

test('mobile tour follows ordinary walk actions, selected pet and language', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/demo');
  const tour = page.locator('.walk-tour');
  await page.locator('.quick-actions').getByRole('button', { name: 'Погуляли' }).click();
  await expect(tour.locator('dd')).toHaveText(['2 / 3', '17 / 21']);
  for (const [lang, label] of [['KZ', 'Серуенді белгілеу'], ['EN', 'Log a walk']]) {
    await page.locator('.account-header').getByRole('button', { name: lang, exact: true }).click();
    await expect(tour.getByRole('button', { name: label })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await tour.getByRole('button', { name: 'Log a walk' }).click();
  await expect(tour.locator('dd')).toHaveText(['2 → 3 / 3', '17 → 18 / 21']);
  await expect(tour.getByRole('button', { name: 'Goal reached' })).toBeDisabled();
  await page.locator('.real-pet-selector').getByRole('button', { name: 'Ума' }).click();
  await expect(tour).toHaveCount(0);
  await page.reload();
  await expect(tour.locator('dd')).toHaveText(['1 / 3', '16 / 21']);
});
