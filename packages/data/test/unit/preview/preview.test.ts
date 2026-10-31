import { existsSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { cities, readNetwork } from '../../../src/city.utils.ts';
import { PREVIEW_SIZE, PREVIEW_THEMES } from '../../../src/preview/preview.constants.ts';
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
