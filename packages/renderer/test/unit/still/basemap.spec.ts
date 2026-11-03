import { describe, expect, test, vi } from 'vitest';
import { BasemapStill } from '../../../src/still/basemap.service';
import { STILL_CREDITS, STILL_FORMAT, STILL_QUALITY, STILL_TIMEOUT_MS, STILL_TRACK } from '../../../src/still/basemap.constants';
import { PALETTES } from '../../../src/layers/theme.constants';
import type { StillRequest } from '../../../src/still/basemap.types';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { LAND_LAYER } from '../../support/fakeMap.constants';

/** A still of a small view. */
const REQUEST: StillRequest = { view: { center: [0.5, 51.5], zoom: 11 }, width: 400, height: 225 };

/**
 * A still-taker on a stand-in, its basemap one background layer.
 *
 * @returns It, and its stand-in.
 */
const stillOf = () => {
  const fake = fakeMap([LAND_LAYER]);
  const still = new BasemapStill({ theme: 'light', createMap: () => fake.map });
  return { still, fake, land: () => fake.layers.get(LAND_LAYER.id)?.paint['background-color'] };
};

describe('BasemapStill', () => {
  test('owes credit to the basemap and to OpenStreetMap', () => {
    expect(BasemapStill.credits).toEqual(STILL_CREDITS);
  });

  test("takes a still once the basemap has loaded, in the theme's colours: the view, the size and the track asked for", async () => {
    const { still, fake, land } = stillOf();
    const picture = still.take({
      ...REQUEST,
      track: [
        {
          color: '#ff0000',
          paths: [
            [
              [0, 51],
              [1, 52],
            ],
          ],
        },
        {
          color: '#0000ff',
          paths: [
            [
              [0, 52],
              [1, 51],
            ],
          ],
          dashed: true,
        },
      ],
    });
    fake.fire('style.load');
    await expect(picture).resolves.toBe(`data:${STILL_FORMAT};quality=${STILL_QUALITY}`);
    expect(land()).toBe(PALETTES.light.background);
    expect(fake.moves.at(-1)).toMatchObject({ kind: 'jump', target: REQUEST.view.center, options: { zoom: REQUEST.view.zoom } });
    expect(fake.resizes()).toBe(1);
    expect(fake.featuresIn(STILL_TRACK.source).map(feature => feature.properties)).toEqual([
      { color: '#ff0000', dashed: false },
      { color: '#0000ff', dashed: true },
    ]);
    expect([...fake.layers.keys()]).toEqual([LAND_LAYER.id, STILL_TRACK.solid, STILL_TRACK.dashed]);
  });

  test('takes each still in turn, each with only its own track, and in the format asked for', async () => {
    const { still, fake } = stillOf();
    fake.fire('style.load');
    const first = still.take({
      ...REQUEST,
      track: [
        {
          color: '#ff0000',
          paths: [
            [
              [0, 51],
              [1, 52],
            ],
          ],
        },
      ],
    });
    const second = still.take({ ...REQUEST, view: { center: [0.2, 51.2], zoom: 9 }, format: 'image/jpeg' });
    await expect(Promise.all([first, second])).resolves.toEqual([`data:${STILL_FORMAT};quality=${STILL_QUALITY}`, `data:image/jpeg;quality=${STILL_QUALITY}`]);
    expect(fake.moves.map(move => move.target)).toEqual([REQUEST.view.center, [0.2, 51.2]]);
    expect(fake.featuresIn(STILL_TRACK.source)).toEqual([]);
  });

  test('a still that fails does not hold up the rest', async () => {
    const { still, fake } = stillOf();
    fake.fire('style.load');
    const picture = fake.canvas.toDataURL;
    fake.canvas.toDataURL = () => {
      fake.canvas.toDataURL = picture;
      throw new Error('tainted canvas');
    };
    const failed = still.take(REQUEST);
    const next = still.take(REQUEST);
    await expect(failed).rejects.toThrow('tainted canvas');
    await expect(next).resolves.toBe(`data:${STILL_FORMAT};quality=${STILL_QUALITY}`);
  });

  test('takes the still anyway once it has waited long enough for tiles that never load', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { still, fake } = stillOf();
    fake.view.tilesLoaded = false;
    fake.fire('style.load');
    let taken = false;
    const picture = still.take(REQUEST).then(() => (taken = true));
    await vi.advanceTimersByTimeAsync(STILL_TIMEOUT_MS - 1);
    expect(taken).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await picture;
    expect(taken).toBe(true);
    vi.useRealTimers();
  });

  test('a new theme colours the stills asked for after it, never one asked for before', async () => {
    const { still, fake, land } = stillOf();
    const colours: unknown[] = [];
    const picture = fake.canvas.toDataURL;
    fake.canvas.toDataURL = (format, quality) => {
      colours.push(land());
      return picture(format, quality);
    };
    const before = still.take(REQUEST);
    still.setTheme('dark');
    const after = still.take(REQUEST);
    fake.fire('style.load');
    await Promise.all([before, after]);
    expect(colours).toEqual([PALETTES.light.background, PALETTES.dark.background]);
  });

  test('takes itself down: the hidden map removed, and its container off the page', () => {
    const { still, fake } = stillOf();
    const container = document.body.lastElementChild;
    expect(container?.isConnected).toBe(true);
    still.destroy();
    expect([fake.isRemoved(), container?.isConnected]).toEqual([true, false]);
  });
});
