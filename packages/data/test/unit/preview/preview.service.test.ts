import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { PREVIEW_SIZE, PREVIEW_THEMES, SOCIAL_SIZE, SOCIAL_THEME } from '../../../src/preview/preview.constants.ts';
import { PreviewRenderer } from '../../../src/preview/preview.service.ts';
import { previewPathOf, socialPathOf } from '../../../src/preview/preview.utils.ts';
import { fakeBrowser } from '../../support/factories/fakeBrowser.utils.ts';
import { cityApart } from '../../support/folders.utils.ts';

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
      await expect(new PreviewRenderer({ launch: browser.launch, report: vi.fn() }).draw('atlantis')).rejects.toThrow('no city atlantis');
      expect(browser.drawn).toEqual([]);
    });
  });

  describe('drawCities', () => {
    test("draws each theme's preview and the social card, writes each beside the network, and closes Chrome", async () => {
      const city = cityApart('kyiv');
      const browser = fakeBrowser(pictureOf);
      const said = vi.fn();
      await new PreviewRenderer({ launch: browser.launch, report: said }).drawCities([city]);
      expect(said).toHaveBeenCalledWith(expect.stringMatching(/^kyiv dark: \d+ KB$/));
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
      await new PreviewRenderer({ launch: browser.launch, report: vi.fn() }).drawCities([cityApart('kyiv')]);
      expect(browser.served.get('/')?.body).toContain('<script src="/preview.js"></script>');
      expect(browser.served.get('/preview.js')?.body).toContain('takePreview');
      expect(browser.served.get('/worker.mjs')?.body.length).toBeGreaterThan(0);
      expect(browser.served.get('/nothing')?.status).toBe(404);
    });

    test('closes Chrome and the server when a picture is not drawn', async () => {
      const browser = fakeBrowser(() => {
        throw new Error('no WebGL');
      });
      const renderer = new PreviewRenderer({ launch: browser.launch, report: vi.fn() });
      await expect(renderer.drawCities([cityApart('kyiv')])).rejects.toThrow('no WebGL');
      expect(browser.isClosed()).toBe(true);
    });

    test('says what goes wrong in the page, its errors and the errors it logs, and nothing else it logs', async () => {
      const said = vi.fn();
      const browser = fakeBrowser((theme, request) => {
        browser.say('pageerror', new Error('tiles refused'));
        browser.say('console', { type: () => 'error', text: () => 'style not found' });
        browser.say('console', { type: () => 'log', text: () => 'drawn' });
        return pictureOf(theme, request);
      });
      await new PreviewRenderer({ launch: browser.launch, report: said }).drawCities([cityApart('kyiv')]);
      expect(said.mock.calls.slice(0, 2)).toEqual([['preview page: tiles refused'], ['preview page: style not found']]);
      expect(said.mock.calls.flat()).not.toContain('preview page: drawn');
    });
  });
});
