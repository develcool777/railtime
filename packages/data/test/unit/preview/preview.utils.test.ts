import { existsSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { cities, readNetwork } from '../../../src/city.utils.ts';
import { MAX_PREVIEW_ZOOM, PREVIEW_PADDING, PREVIEW_SIZE, PREVIEW_THEMES } from '../../../src/preview/preview.constants.ts';
import { previewPathOf, previewRequestOf, previewTrackOf, socialPathOf } from '../../../src/preview/preview.utils.ts';

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
  describe('previewTrackOf', () => {
    test("draws today's track in each theme's colours, the first line on top", () => {
      const london = networkOf('london');
      const dark = previewTrackOf(london, 'dark');
      expect(dark.length).toBeGreaterThan(10);
      expect(dark.every(line => !line.dashed)).toBe(true);
      // The network's first line is drawn last, on top.
      const first = Object.values(london.lines)[0];
      expect(dark.at(-1)?.color).toBe(first?.darkColor ?? first?.color);
    });

    test('draws a network never built as its first plan, dashed', () => {
      const track = previewTrackOf(networkOf('bratislava'), 'light');
      expect(track.length).toBeGreaterThan(0);
      expect(track.every(line => line.dashed)).toBe(true);
    });
  });

  describe('previewRequestOf', () => {
    test('frames the track at the preview size', () => {
      const request = previewRequestOf(networkOf('kyiv'), 'dark', PREVIEW_SIZE);
      expect(request).toMatchObject({ ...PREVIEW_SIZE, padding: PREVIEW_PADDING, maxZoom: MAX_PREVIEW_ZOOM });
      expect(request?.points).toEqual(request?.track?.flatMap(line => line.paths.flat()));
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
