import { describe, expect, test, vi } from 'vitest';
import { PALETTES } from '../../../src/layers/theme.constants';
import { STILL_FORMAT, STILL_QUALITY, STILL_TIMEOUT_MS, STILL_TRACK } from '../../../src/still/basemap.constants';
import { BasemapStill } from '../../../src/still/basemap.service';
import type { StillRequest } from '../../../src/still/basemap.types';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { LAND_LAYER } from '../../support/fakeMap.constants';

/** A still of a small view: two points either side of its middle. */
const REQUEST: StillRequest = {
  points: [
    [0.4, 51.4],
    [0.6, 51.6],
  ],
  padding: 18,
  maxZoom: 11,
  width: 400,
  height: 225,
};

/**
 * A still-taker on a stand-in, its basemap one background layer.
 *
 * @returns It, and its stand-in.
 */
const stillOf = () => {
  const fake = fakeMap([LAND_LAYER]);
  Object.assign(fake.view, { width: REQUEST.width, height: REQUEST.height });
  const still = new BasemapStill({ theme: 'light', createMap: () => fake.map });
  return { still, fake, land: () => fake.layers.get(LAND_LAYER.id)?.paint['background-color'] };
};

describe('BasemapStill', () => {
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
    expect(fake.moves.at(-1)).toMatchObject({ kind: 'jump', target: [expect.closeTo(0.5), expect.closeTo(51.5)] });
    expect(fake.resizes()).toBe(1);
    expect(fake.featuresIn(STILL_TRACK.source).map(feature => feature.properties)).toEqual([
      { color: '#ff0000', dashed: false },
      { color: '#0000ff', dashed: true },
    ]);
    expect([...fake.layers.keys()]).toEqual([LAND_LAYER.id, STILL_TRACK.solid, STILL_TRACK.dashed]);
  });

  test('frames its points inside the padding asked for, no closer than its `maxZoom`', async () => {
    const zoomOf = async (request: Partial<StillRequest>) => {
      const { still, fake } = stillOf();
      fake.fire('style.load');
      await still.take({ ...REQUEST, ...request });
      return Number(fake.moves.at(-1)?.options.zoom);
    };
    const room = (padding: number) => (REQUEST.height - padding * 2) / (0.2 * 1.6);
    const padded = await zoomOf({ maxZoom: 20 });
    expect(padded).toBeCloseTo(Math.log2(room(18) / (512 / 360)));
    await expect(zoomOf({ maxZoom: 20, padding: 60 })).resolves.toBeCloseTo(Math.log2(room(60) / (512 / 360)));
    await expect(zoomOf({ maxZoom: 7 })).resolves.toBe(7);
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
    const second = still.take({ ...REQUEST, points: [[0.2, 51.2]], format: 'image/jpeg' });
    await expect(Promise.all([first, second])).resolves.toEqual([`data:${STILL_FORMAT};quality=${STILL_QUALITY}`, `data:image/jpeg;quality=${STILL_QUALITY}`]);
    expect(fake.moves.map(move => move.target)).toEqual([
      [expect.closeTo(0.5), expect.closeTo(51.5)],
      [0.2, 51.2],
    ]);
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
    const takeAndTell = async () => {
      await still.take(REQUEST);
      taken = true;
    };
    const picture = takeAndTell();
    await vi.advanceTimersByTimeAsync(STILL_TIMEOUT_MS - 1);
    expect(taken).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await picture;
    expect(taken).toBe(true);
    vi.useRealTimers();
  });

  test('takes itself down: the hidden map removed, and its container off the page', () => {
    const { still, fake } = stillOf();
    const container = document.body.lastElementChild;
    expect(container?.isConnected).toBe(true);
    still.destroy();
    expect([fake.isRemoved(), container?.isConnected]).toEqual([true, false]);
  });
});
