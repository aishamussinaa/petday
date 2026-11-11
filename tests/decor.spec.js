import { test, expect } from '@playwright/test';

test('переключатель декора доступен с клавиатуры и сохраняет выбор', async ({ page }) => {
  await page.goto('/');
  const motion = page.getByRole('switch', { name: 'Анимация декора' });
  await expect(motion).toBeChecked();
  await page.locator('.preview-pets').getByRole('button', { name: 'Ума' }).click();
  await motion.focus();
  await page.keyboard.press('Space');
  await expect(motion).not.toBeChecked();
  await expect(motion).toBeFocused();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Decorative motion' })).not.toBeChecked();
  await expect(page.locator('.preview-pets').getByRole('button', { name: 'Ума' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Decorative motion' })).not.toBeChecked();
  await expect(page.locator('.hero-poodle')).toHaveAttribute('src', '/images/attached-poodle-cutout.png');
  await page.goto('/demo');
  await expect(page.locator('.pet-name-row h2')).toHaveText('Томми');
  await expect(page.locator('.pet-photo img')).toHaveAttribute('src', '/images/poodle.jpg');
});

test('системное уменьшение движения имеет приоритет и реагирует на изменение', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('petday.decorMotion', 'on'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const motion = page.getByRole('switch');
  await expect(motion).not.toBeChecked();
  await expect(motion).toBeDisabled();
  await expect(page.locator('.hero-flower')).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(motion).toBeChecked();
  await expect(motion).toBeEnabled();
  await motion.click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(motion).not.toBeChecked();
});

test('декор движется, текст неподвижен, отключение останавливает эффекты', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const flower = page.locator('.hero-flower');
  const bowl = page.locator('.schedule-note .decor-rock');
  const initialFlower = await flower.evaluate(el => getComputedStyle(el).transform);
  const initialBowl = await bowl.evaluate(el => getComputedStyle(el).transform);
  const heading = await page.locator('h1').boundingBox();
  const button = await page.locator('.hero-actions .editorial-button').boundingBox();
  await expect.poll(() => flower.evaluate(el => getComputedStyle(el).transform)).not.toBe(initialFlower);
  await expect.poll(() => bowl.evaluate(el => getComputedStyle(el).transform)).not.toBe(initialBowl);
  expect(await page.locator('h1').boundingBox()).toEqual(heading);
  expect(await page.locator('.hero-actions .editorial-button').boundingBox()).toEqual(button);
  await page.locator('.preview-paw-trail').scrollIntoViewIfNeeded();
  await expect(page.locator('.preview-paw-trail')).toHaveClass(/is-visible/);
  await expect(page.locator('.preview-paw-trail > span').last()).toHaveCSS('animation-delay', '0.75s');
  await expect(page.locator('.preview-paw-trail > span').last()).toHaveCSS('opacity', '1');
  await page.locator('.final-ball').hover();
  await expect(page.locator('.final-ball > svg')).not.toHaveCSS('transform', 'none');
  await page.getByRole('switch').click();
  for (const locator of [flower, bowl, page.locator('.preview-paw-trail > span').last()]) {
    await expect(locator).toHaveCSS('animation-name', 'none');
  }
  await page.locator('.final-ball').hover();
  await expect(page.locator('.final-ball > svg')).toHaveCSS('transform', 'none');
});
