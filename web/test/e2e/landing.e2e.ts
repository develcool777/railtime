import CITY_INDEX from '@railtime/data/cities.json' with { type: 'json' };
import { expect, test } from '../support/browser.utils';

/** Every city's name, as the index lists them. */
const CITY_NAMES = Object.values(CITY_INDEX).map(entry => entry.name);

test.describe('Landing', () => {
  test('lists every city, each a card', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(`${CITY_NAMES.length} cities`, { exact: true })).toBeVisible();
    const cards = await Promise.all(CITY_NAMES.map(async name => ({ name, links: await page.getByRole('link', { name }).count() })));
    expect(cards.filter(card => card.links === 0)).toEqual([]);
  });

  test('narrows the list to the cities a search finds', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('textbox', { name: 'Search cities' }).fill('Kyiv');

    await expect(page.getByText(`1 of ${CITY_NAMES.length} cities`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByText(`${CITY_NAMES.length} cities`, { exact: true })).toBeVisible();
  });

  test('opens a city from its card', async ({ page }) => {
    await page.goto('/');

    // From the keyboard: the card's link is laid over the whole card, with nothing of its own to see, so
    // Playwright will not click it, nor the title under it.
    await page.getByRole('link', { name: 'Kyiv' }).focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/kyiv\/?$/);
    await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
  });

  for (const path of ['/about/', '/privacy/', '/terms/']) {
    test(`serves ${path}`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    });
  }

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('fits the list to the screen', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByRole('textbox', { name: 'Search cities' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    });
  });
});
