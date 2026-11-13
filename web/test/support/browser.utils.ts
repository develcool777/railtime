import { test as base, expect } from '@playwright/test';

export { expect } from '@playwright/test';

/** The stand-in basemap's glyph server: a host that never resolves, answered here. */
const GLYPHS_HOST = 'basemap.invalid';

/** A basemap with nothing on it but its background and a glyph server: what the map needs to load. */
const STAND_IN_STYLE = {
  version: 8,
  // MapLibre's placeholders, filled in by the map, not by this file.
  glyphs: 'https://basemap.invalid/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eeeeee' } }],
};

/**
 * Playwright's `test`, with each page kept to the build: a request outside it is answered by a stand-in
 * basemap (its style, and glyphs with no glyph in them), or refused, so no test waits on the tile server
 * or fails with it. And as the unit tests' setup does, an error the page throws or logs fails the test.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    // Where the build is served, as `playwright.config.ts` says.
    const origin = new URL('/', baseURL).origin;
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.route(
      url => url.origin !== origin,
      async route => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/styles/')) return route.fulfill({ json: STAND_IN_STYLE });
        if (url.hostname === GLYPHS_HOST) return route.fulfill({ body: Buffer.alloc(0), contentType: 'application/x-protobuf' });
        errors.push(`A request outside the build: ${url.href}`);
        return route.abort();
      },
    );
    await use(page);
    expect(errors, 'what the page threw or logged as an error').toEqual([]);
  },
});
