import type { Bounds } from '@railtime/core/geometry.types';
import { describe, expect, test, vi } from 'vitest';
import type { FeatureCollection } from '../../../src/layers/snapshot.types';
import { PALETTES } from '../../../src/layers/theme.constants';
import {
  MINIMAP_LAYERS,
  MINIMAP_LINE_WIDTH,
  MINIMAP_SOURCES,
  MINIMAP_UPDATE_MS,
  MINIMAP_VIEWPORT_CLASS,
  MINIMAP_VIEWPORT_COLOR,
  MINIMAP_VIEWPORT_MIN_PX,
} from '../../../src/minimap/minimap.constants';
import { Minimap } from '../../../src/minimap/minimap.service';
import { viewportBox } from '../../../src/minimap/minimap.utils';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { LAND_LAYER } from '../../support/fakeMap.constants';

/** The city it frames. */
const BOUNDS: Bounds = [
  [0, 51],
  [1, 52],
];

/** A line's feature, as the main map sends it. */
const LINE = {
  type: 'Feature',
  properties: { color: '#ff0000', planned: false },
  geometry: {
    type: 'LineString',
    coordinates: [
      [0, 51],
      [1, 52],
    ],
  },
} as const;

/**
 * Lines as a collection.
 *
 * @param count - How many.
 * @returns The collection.
 */
const linesOf = (count: number) => ({ type: 'FeatureCollection', features: Array.from({ length: count }, () => LINE) }) as unknown as FeatureCollection<never>;

/**
 * A minimap on a stand-in, over a stand-in main map, in a container whose size and watcher a test sets.
 *
 * @returns The minimap, its stand-in, the main map's, its container, and what watches the container.
 */
const minimapOf = () => {
  const watcher = { onResize: (): void => {}, watching: false };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      public constructor(callback: () => void) {
        watcher.onResize = callback;
      }

      /** Starts watching. */
      public observe(): void {
        watcher.watching = true;
      }

      /** Stops watching. */
      public disconnect(): void {
        watcher.watching = false;
      }
    },
  );
  const fake = fakeMap([LAND_LAYER]);
  const main = fakeMap();
  const container = document.createElement('div');
  const size = { width: 0, height: 0 };
  Object.defineProperties(container, {
    clientWidth: { get: () => size.width },
    clientHeight: { get: () => size.height },
  });
  const minimap = new Minimap({ container, main: main.map, createMap: () => fake.map, style: 'style.json', bounds: BOUNDS, palette: PALETTES.dark });
  const box = () => container.querySelector<HTMLElement>(`.${MINIMAP_VIEWPORT_CLASS}`);
  return { minimap, fake, main, container, size, watcher, box };
};

describe('MinimapUtils', () => {
  describe('viewportBox', () => {
    test("outlines the view's projected corners", () => {
      expect(viewportBox({ x: 10, y: 20 }, { x: 50, y: 45 })).toEqual({ left: 10, top: 20, width: 40, height: 25 });
    });

    test('keeps a view closer in than a few pixels visible, centred where it is', () => {
      expect(viewportBox({ x: 30, y: 30 }, { x: 31, y: 30.5 })).toEqual({
        left: 30.5 - MINIMAP_VIEWPORT_MIN_PX / 2,
        top: 30.25 - MINIMAP_VIEWPORT_MIN_PX / 2,
        width: MINIMAP_VIEWPORT_MIN_PX,
        height: MINIMAP_VIEWPORT_MIN_PX,
      });
    });
  });
});

describe('Minimap', () => {
  test('keeps what it is sent before its style loads, and shows it once loaded: the network, a plan, the change playing', () => {
    const { minimap, fake } = minimapOf();
    minimap.setNetwork({ lines: linesOf(2), planned: linesOf(1) });
    minimap.setActive(linesOf(1));
    expect(fake.data.size).toBe(0);
    fake.fire('style.load');
    expect([MINIMAP_SOURCES.lines, MINIMAP_SOURCES.planned, MINIMAP_SOURCES.active].map(source => fake.featuresIn(source).length)).toEqual([2, 1, 1]);
  });

  test('draws a line growing as wide as the rest, so it never swells and shrinks back', () => {
    const { fake } = minimapOf();
    fake.fire('style.load');
    const widths = Object.values(MINIMAP_LAYERS).map(id => fake.layers.get(id)?.paint['line-width']);
    expect(widths).toEqual(Object.values(MINIMAP_LAYERS).map(() => MINIMAP_LINE_WIDTH));
  });

  test('sends what changes at most once in so long, by the clock of the frames that ask, and the latest when due', () => {
    const { minimap, fake } = minimapOf();
    fake.fire('style.load');
    const sent = (source: string) => [fake.sends.get(source), fake.featuresIn(source).length];
    minimap.setActive(linesOf(1));
    minimap.setNetwork({ lines: linesOf(1), planned: linesOf(0) });
    expect(sent(MINIMAP_SOURCES.active)).toEqual([undefined, 0]);
    minimap.flush(1000);
    expect([sent(MINIMAP_SOURCES.active), sent(MINIMAP_SOURCES.lines)]).toEqual([
      [1, 1],
      [1, 1],
    ]);
    minimap.setActive(linesOf(2));
    minimap.setNetwork({ lines: linesOf(2), planned: linesOf(0) });
    minimap.setActive(linesOf(3));
    minimap.setNetwork({ lines: linesOf(3), planned: linesOf(0) });
    minimap.flush(1000 + MINIMAP_UPDATE_MS - 1);
    expect([sent(MINIMAP_SOURCES.active), sent(MINIMAP_SOURCES.lines)]).toEqual([
      [1, 1],
      [1, 1],
    ]);
    minimap.flush(1000 + MINIMAP_UPDATE_MS);
    expect([sent(MINIMAP_SOURCES.active), sent(MINIMAP_SOURCES.lines)]).toEqual([
      [2, 3],
      [2, 3],
    ]);
  });

  test('waits for no timer: with no frame asking, nothing is sent however long it waits', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
    const { minimap, fake } = minimapOf();
    fake.fire('style.load');
    minimap.setActive(linesOf(1));
    minimap.flush(0);
    minimap.setActive(linesOf(2));
    vi.advanceTimersByTime(MINIMAP_UPDATE_MS * 10);
    expect(fake.featuresIn(MINIMAP_SOURCES.active)).toHaveLength(1);
    vi.useRealTimers();
  });

  test('clears a change once, whatever network sent it, and sends nothing for no change', () => {
    const { minimap, fake } = minimapOf();
    fake.fire('style.load');
    minimap.setActive(linesOf(0));
    minimap.flush(0);
    expect(fake.sends.get(MINIMAP_SOURCES.active)).toBeUndefined();
    minimap.setActive(linesOf(2));
    minimap.flush(100);
    minimap.setActive(linesOf(0));
    minimap.setActive(linesOf(0));
    minimap.flush(200);
    minimap.setActive(linesOf(0));
    minimap.flush(300);
    expect([fake.sends.get(MINIMAP_SOURCES.active), fake.featuresIn(MINIMAP_SOURCES.active).length]).toEqual([2, 0]);
  });

  test("outlines the main camera's view, and follows it", () => {
    const { fake, main, box } = minimapOf();
    fake.view.zoom = 7;
    const outline = () =>
      viewportBox(fake.map.project([main.view.center[0] - 1, main.view.center[1] + 1]), fake.map.project([main.view.center[0] + 1, main.view.center[1] - 1]));
    const placed = () => (['left', 'top', 'width', 'height'] as const).map(side => Number.parseFloat(box()?.style[side] ?? ''));
    const expectOver = ({ left, top, width, height }: ReturnType<typeof outline>) => {
      for (const [side, pixels] of [left, top, width, height].entries()) expect(placed()[side]).toBeCloseTo(pixels, 3);
    };
    main.fire('move');
    expect(box()?.dataset.shown).toBe('');
    expectOver(outline());
    main.view.center = [0.5, 51.2];
    main.fire('move');
    expectOver(outline());
  });

  test('fits the city again once its container gets a size, not while it is hidden; and frames another network', () => {
    const { minimap, fake, size, watcher } = minimapOf();
    expect(watcher.watching).toBe(true);
    watcher.onResize();
    expect([fake.resizes(), fake.moves]).toEqual([0, []]);
    Object.assign(size, { width: 200, height: 120 });
    watcher.onResize();
    expect(fake.resizes()).toBe(1);
    expect(fake.moves).toEqual([expect.objectContaining({ kind: 'fit', target: BOUNDS, options: expect.objectContaining({ animate: false }) })]);
    const planned: Bounds = [
      [0, 50],
      [2, 52],
    ];
    minimap.frame(planned);
    watcher.onResize();
    expect(fake.moves.map(move => move.target)).toEqual([BOUNDS, planned, planned]);
  });

  test("recolours for a theme: the box at once, the basemap once it has loaded, in the theme's colours", () => {
    const { minimap, fake, box } = minimapOf();
    expect(box()?.style.getPropertyValue(MINIMAP_VIEWPORT_COLOR)).toBe(PALETTES.dark.viewport);
    minimap.setPalette(PALETTES.light);
    expect(box()?.style.getPropertyValue(MINIMAP_VIEWPORT_COLOR)).toBe(PALETTES.light.viewport);
    expect(fake.layers.get(LAND_LAYER.id)?.paint['background-color']).toBe(LAND_LAYER.paint['background-color']);
    fake.fire('style.load');
    expect(fake.layers.get(LAND_LAYER.id)?.paint['background-color']).toBe(PALETTES.light.background);
    minimap.setPalette(PALETTES.dark);
    expect(fake.layers.get(LAND_LAYER.id)?.paint['background-color']).toBe(PALETTES.dark.background);
  });

  test('takes itself down: the box gone, the map removed, its container no longer watched', () => {
    const { minimap, fake, container, watcher } = minimapOf();
    fake.fire('style.load');
    minimap.destroy();
    expect([container.childElementCount, fake.isRemoved(), watcher.watching]).toEqual([0, true, false]);
  });
});
