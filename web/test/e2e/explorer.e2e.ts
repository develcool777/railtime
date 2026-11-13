import type { Page } from '@playwright/test';
import { expect, test } from '../support/browser.utils';

/** A city whose page every test opens: one network, a few lines, a long history. */
const CITY = '/kyiv/';

/**
 * Where the address says the map is in time.
 *
 * @param page - The page.
 * @returns Its `at` parameter, or `null` where the map rests at today.
 */
const linkedMoment = (page: Page): string | null => new URL(page.url()).searchParams.get('at');

/**
 * Opens the city, and waits for its map to be ready: its time control beneath it.
 *
 * @param page - The page.
 */
const openCity = async (page: Page): Promise<void> => {
  await page.goto(CITY);
  await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Show the network on a date' })).toBeVisible();
};

test.describe('Explorer', () => {
  test('opens a city on its map, at today, with its lines listed', async ({ page }) => {
    await openCity(page);

    await expect(page.getByRole('button', { name: 'Lines', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('region', { name: 'Panel' }).getByRole('listitem').first()).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: /^Today$/ })).toBeVisible();
    expect(linkedMoment(page)).toBeNull();
  });

  test('steps back a change, and a reload comes back to the same moment', async ({ page }) => {
    await openCity(page);

    await page.getByRole('button', { name: 'Previous change' }).click();
    await expect.poll(() => linkedMoment(page)).not.toBeNull();
    const moment = linkedMoment(page);
    const year = await page.getByRole('slider', { name: 'Show the network on a date' }).getAttribute('aria-valuenow');

    await page.reload();
    await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();

    await expect(page.getByRole('slider', { name: 'Show the network on a date' })).toHaveAttribute('aria-valuenow', year ?? '');
    expect(linkedMoment(page)).toBe(moment);
  });

  test('plays on from the moment shown', async ({ page }) => {
    await openCity(page);
    await page.getByRole('button', { name: 'Previous change' }).click();
    await expect.poll(() => linkedMoment(page)).not.toBeNull();
    const moment = linkedMoment(page);

    await page.getByRole('button', { name: 'Play', exact: true }).click();

    await expect.poll(() => linkedMoment(page)).not.toBe(moment);
  });

  test('keeps the section and the station open in the address, across a reload', async ({ page }) => {
    await openCity(page);

    await page.getByRole('button', { name: 'Stations', exact: true }).click();
    await expect(page).toHaveURL(/[?&]tab=stations/);
    await page.reload();

    await expect(page.getByRole('button', { name: 'Stations', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('answers an address with no city as not found', async ({ request }) => {
    const response = await request.get('/nowhere/');

    expect(response.status()).toBe(404);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('fits the city page to the screen, its panel a sheet', async ({ page }) => {
      await openCity(page);

      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
      await expect(page.getByRole('dialog', { name: 'Panel' })).toBeAttached();
    });
  });
});
