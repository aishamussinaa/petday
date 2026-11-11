import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

function fontHasCodePoint(buffer, code) {
  const tables = buffer.readUInt16BE(4);
  let cmap = 0;
  for (let i = 0; i < tables; i++) {
    const at = 12 + i * 16;
    if (buffer.toString('ascii', at, at + 4) === 'cmap') cmap = buffer.readUInt32BE(at + 8);
  }
  const count = buffer.readUInt16BE(cmap + 2);
  for (let i = 0; i < count; i++) {
    const offset = cmap + buffer.readUInt32BE(cmap + 4 + i * 8 + 4);
    const format = buffer.readUInt16BE(offset);
    if (format === 12) {
      const groups = buffer.readUInt32BE(offset + 12);
      for (let j = 0; j < groups; j++) {
        const at = offset + 16 + j * 12;
        if (code >= buffer.readUInt32BE(at) && code <= buffer.readUInt32BE(at + 4)) return true;
      }
    }
    if (format === 4) {
      const segments = buffer.readUInt16BE(offset + 6) / 2;
      const end = offset + 14;
      const start = end + segments * 2 + 2;
      const delta = start + segments * 2;
      const ranges = delta + segments * 2;
      for (let j = 0; j < segments; j++) {
        const first = buffer.readUInt16BE(start + j * 2);
        if (code < first || code > buffer.readUInt16BE(end + j * 2)) continue;
        const range = buffer.readUInt16BE(ranges + j * 2);
        const shift = buffer.readInt16BE(delta + j * 2);
        if (!range) return ((code + shift) & 65535) !== 0;
        return buffer.readUInt16BE(ranges + j * 2 + range + (code - first) * 2) !== 0;
      }
    }
  }
  return false;
}

test('локальная гарнитура содержит русские и казахские буквы', () => {
  for (const name of ['noto-sans', 'golos-text']) {
    const font = readFileSync(name === 'noto-sans' ? 'tests/fixtures/noto-sans.ttf' : 'client/public/fonts/golos-text.ttf');
    for (const letter of 'ӘҒҚҢӨҰҮҺІәғқңөұүһіАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ') {
      expect(fontHasCodePoint(font, letter.codePointAt(0)), `${name}: ${letter}`).toBe(true);
    }
  }
});

test('маршруты, меню, живой фрагмент и сохранение состояния', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('У каждого хвостика свой распорядок');
  const menu = page.getByRole('button', { name: 'Меню', exact: true });
  await menu.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole('dialog').getByRole('link', { name: /Как это работает/ }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page).toHaveURL(/#preview$/);
  await page.getByRole('checkbox', { name: 'Выполнение: Расчесать шерсть' }).check();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  await page.locator('.hero-copy').getByRole('link', { name: 'Открыть демо', exact: true }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  await page.getByRole('link', { name: 'На главную', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  await page.goto('/demo');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('План на сегодня');
});

for (const width of [390, 768, 1440]) {
  test(`главная и кабинет, три языка, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['/', '/demo']) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      for (const language of ['RU', 'KZ', 'EN']) {
        await page.getByRole('button', { name: language, exact: true }).click();
        await expect(page.getByRole('button', { name: language, exact: true })).toHaveCSS('background-color', 'rgb(255, 227, 109)');
        await expect(page.locator('html')).toHaveAttribute('lang', { RU: 'ru', KZ: 'kk', EN: 'en' }[language]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} ${language} ${width}`).toBe(true);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const smallText = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.checkVisibility() && [...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14).map(el => el.textContent.trim()));
        expect(smallText, 'Видимые подписи не должны быть мельче 14 px').toEqual([]);
        await page.evaluate(() => Promise.all([...document.images].filter(img => img.loading !== 'lazy').map(img => img.decode())));
        if (language !== 'RU') await page.screenshot({ path: `test-results/${route === '/' ? 'home' : 'app'}-${language.toLowerCase()}-${width}.png` });
      }
      await page.getByRole('button', { name: 'RU', exact: true }).click();
      await page.screenshot({ path: `test-results/${route === '/' ? 'home' : 'app'}-${width}.png`, fullPage: true });
      if (route === '/') {
        await page.screenshot({ path: `test-results/home-top-${width}.png` });
        await page.locator('.preview-section').scrollIntoViewIfNeeded();
        await page.waitForTimeout(650);
        await page.locator('.preview-section').screenshot({ path: `test-results/home-preview-${width}.png` });
      }
    }
    expect(errors).toEqual([]);
  });
}

test('reduced motion сохраняет видимость и отключает анимацию', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  await page.locator('.final-invite').scrollIntoViewIfNeeded();
  await expect(page.locator('.final-invite h2')).toBeVisible();
  expect(await page.locator('.final-invite').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
});

test('казахская дата и фотография записи соответствуют выбранному питомцу', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 22, 12));
  await page.goto('/demo');
  await page.getByRole('button', { name: 'KZ', exact: true }).click();
  await expect(page.locator('.date-line')).toContainText('22 қазан, бейсенбі');
  await page.goto('/');
  await expect(page.locator('.health-photo img')).toHaveAttribute('src', '/images/poodle.jpg');
  await page.locator('.preview-pets').getByRole('button', { name: 'Ума' }).click();
  await expect(page.locator('.health-photo img')).toHaveAttribute('src', '/images/uma.jpg');
  await expect(page.locator('.health-pet')).toHaveText('Ума');
  await expect(page.locator('.health-paper time')).toHaveText('2026 ж. 3 қараша');
});
