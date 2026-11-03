import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { cities, readNetwork } from '../../../src/city.utils.ts';
import { PREVIEW_SIZE, PREVIEW_THEMES, SOCIAL_SIZE, SOCIAL_THEME } from '../../../src/preview/preview.constants.ts';
import { fakeBrowser } from '../../support/factories/fakeBrowser.utils.ts';
import { cityApart } from '../../support/folders.utils.ts';
import { PreviewRenderer } from '../../../src/preview/preview.service.ts';
import { fitView, previewPathOf, previewRequestOf, previewTrackOf, socialPathOf } from '../../../src/preview/preview.utils.ts';

/** Every city. */
const CITIES = cities();

/**
 * A city's network, by its id.
 *
 * @param id - The city's folder.
 * @returns Its network.
 */
const networkOf = (id: string) => {
  const found = CITIES.find(city => city.id === id);
  if (!found) throw new Error(`No city ${id}`);
  return readNetwork(found);
};

describe('PreviewUtils', () => {
  describe('fitView', () => {
    test('centres the points, and zooms in no further than a street', () => {
      const view = fitView(
        [
          [30, 50],
          [30.1, 50],
        ],
        PREVIEW_SIZE,
      );
      expect(view.center[0]).toBeCloseTo(30.05, 6);
      expect(view.center[1]).toBeCloseTo(50, 6);
      expect(fitView([[30, 50]], PREVIEW_SIZE).zoom).toBe(15);
    });
  });

  describe('previewTrackOf', () => {
    test("draws today's track in each theme's colours, the first line on top", () => {
      const london = networkOf('london');
      const dark = previewTrackOf(london, 'dark');
      expect(dark.length).toBeGreaterThan(10);
      expect(dark.every(line => !line.dashed)).toBe(true);
      // The network's first line is drawn last, on top.
      expect(dark[dark.length - 1]?.color).toBe(
        london.lines[Object.keys(london.lines)[0] ?? '']?.darkColor ?? london.lines[Object.keys(london.lines)[0] ?? '']?.color,
      );
    });

    test('draws a network never built as its first plan, dashed', () => {
      const track = previewTrackOf(networkOf('bratislava'), 'light');
      expect(track.length).toBeGreaterThan(0);
      expect(track.every(line => line.dashed)).toBe(true);
    });
  });

  describe('previewRequestOf', () => {
    test('frames the track at the preview size', () => {
      expect(previewRequestOf(networkOf('kyiv'), 'dark', PREVIEW_SIZE)).toMatchObject({ ...PREVIEW_SIZE, view: { zoom: expect.any(Number) } });
    });

    test('asks for no picture of a network with no track', () => {
      const kyiv = networkOf('kyiv');
      expect(previewRequestOf({ ...kyiv, lines: {}, stations: {}, segments: [], plans: {} }, 'dark', PREVIEW_SIZE)).toBeNull();
    });
  });

  describe('previewPathOf', () => {
    test('keeps each theme, and the social card, beside the network', () => {
      expect(previewPathOf('/cities/ukraine/kyiv/kyiv.json', 'dark')).toBe('/cities/ukraine/kyiv/kyiv.dark.webp');
      expect(socialPathOf('/cities/ukraine/kyiv/kyiv.json')).toBe('/cities/ukraine/kyiv/kyiv.social.jpg');
    });

    test.each(CITIES.map(city => ({ id: city.id, path: city.networkPath })))('$id has a preview in every theme (pnpm data:previews <city>)', ({ path }) => {
      for (const picture of [...PREVIEW_THEMES.map(theme => previewPathOf(path, theme)), socialPathOf(path)]) {
        expect(existsSync(picture), picture).toBe(true);
        expect(statSync(picture).size).toBeGreaterThan(2048);
      }
    });
  });
});

describe('PreviewRenderer', () => {
  /**
   * A picture standing for one drawn: its theme and width, as a data URL.
   *
   * @param theme - The theme.
   * @param request - The request.
   * @returns The data URL.
   */
  const pictureOf = (theme: string, request: { width: number }) => {
    const content = Buffer.from(`${theme} ${request.width}`).toString('base64');
    return `data:image/webp;base64,${content}`;
  };

  describe('draw', () => {
    test('refuses a city it does not know, before starting anything', async () => {
      const browser = fakeBrowser(pictureOf);
      await expect(new PreviewRenderer({ launch: browser.launch }).draw('atlantis')).rejects.toThrow('no city atlantis: usage: pnpm data:previews [city]');
      expect(browser.drawn).toEqual([]);
    });
  });

  describe('drawCities', () => {
    test("draws each theme's preview and the social card, writes each beside the network, and closes Chrome", async () => {
      const city = cityApart('kyiv');
      const browser = fakeBrowser(pictureOf);
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await new PreviewRenderer({ launch: browser.launch }).drawCities([city]);
      expect(browser.drawn.map(({ theme, request }) => [theme, request.width, request.format])).toEqual([
        ...PREVIEW_THEMES.map(theme => [theme, PREVIEW_SIZE.width, undefined]),
        [SOCIAL_THEME, SOCIAL_SIZE.width, 'image/jpeg'],
      ]);
      for (const theme of PREVIEW_THEMES) expect(readFileSync(previewPathOf(city.networkPath, theme), 'utf8')).toBe(`${theme} ${PREVIEW_SIZE.width}`);
      expect(readFileSync(socialPathOf(city.networkPath), 'utf8')).toBe(`${SOCIAL_THEME} ${SOCIAL_SIZE.width}`);
      expect(browser.isClosed()).toBe(true);
    });

    test('serves the page its script and MapLibre its worker, and nothing else', async () => {
      const browser = fakeBrowser(pictureOf);
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await new PreviewRenderer({ launch: browser.launch }).drawCities([cityApart('kyiv')]);
      expect(browser.served.get('/')?.body).toContain('<script src="/preview.js"></script>');
      expect(browser.served.get('/preview.js')?.body).toContain('takePreview');
      expect(browser.served.get('/worker.mjs')?.body.length).toBeGreaterThan(0);
      expect(browser.served.get('/nothing')?.status).toBe(404);
    });

    test('closes Chrome and the server when a picture is not drawn', async () => {
      const browser = fakeBrowser(() => {
        throw new Error('no WebGL');
      });
      const renderer = new PreviewRenderer({ launch: browser.launch });
      await expect(renderer.drawCities([cityApart('kyiv')])).rejects.toThrow('no WebGL');
      expect(browser.isClosed()).toBe(true);
    });

    test('says what goes wrong in the page, its errors and the errors it logs, and nothing else it logs', async () => {
      const said = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const browser = fakeBrowser((theme, request) => {
        browser.say('pageerror', new Error('tiles refused'));
        browser.say('console', { type: () => 'error', text: () => 'style not found' });
        browser.say('console', { type: () => 'log', text: () => 'drawn' });
        return pictureOf(theme, request);
      });
      await new PreviewRenderer({ launch: browser.launch }).drawCities([cityApart('kyiv')]);
      expect(said.mock.calls.slice(0, 2)).toEqual([['preview page: tiles refused'], ['preview page: style not found']]);
      expect(said.mock.calls.flat()).not.toContain('preview page: drawn');
      said.mockClear();
    });
  });
});
