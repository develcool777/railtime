import { describe, expect, test } from 'vitest';
import { toTimestamp } from '@railtime/core/date.utils';
import type { FeatureCollection } from '../../src/layers/snapshot.types';
import { LAYERS, SOURCES } from '../../src/layers/ids.constants';
import { DEFAULT_BASEMAP_CREDITS, OPENSTREETMAP_CREDIT } from '../../src/layers/theme.constants';
import { NetworkFacts } from '@railtime/network/facts.service';
import { VIEW_3D_PITCH } from '../../src/playback/camera.constants';
import { TransitMap } from '../../src/transitMap.service';
import { MAX_TILE_WAIT_SECONDS, OPENING_MAX_ZOOM, OPENING_SIDE_PADDING } from '../../src/transitMap.constants';
import type { MapProps, TransitMapListeners } from '../../src/transitMap.types';
import { openingOf } from '../../src/transitMap.utils';
import { fakeMap } from '../support/factories/fakeMap.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';

/**
 * The tiny network's map on a stand-in, with frames stepped by hand, and every event it delivers.
 *
 * @param props - Its props at first.
 * @param on - Its listeners, besides the one recording every event.
 * @returns The map, the stand-in, a frame stepper and the events delivered, in order.
 */
const mapOf = (props: Partial<MapProps> = {}, on: TransitMapListeners = {}) => {
  const fake = fakeMap();
  const pending: ((now: number) => void)[] = [];
  const events: { name: string; payload: unknown }[] = [];
  const recordAll = Object.fromEntries(
    ['status', 'time', 'step', 'stepProgress', 'end', 'stationClick', 'selectionGone', 'overlay', 'view'].map(name => [
      name,
      (payload: unknown) => {
        events.push({ name, payload });
        (on as Record<string, ((payload: unknown) => void) | undefined>)[name]?.(payload);
      },
    ]),
  );
  const map = new TransitMap({
    container: {} as HTMLElement,
    props: { facts: NetworkFacts.create(tinyNetwork(), { today: toTimestamp('2026-01-01') }), ...props },
    on: recordAll,
    createMap: () => fake.map,
    scheduler: { request: frame => pending.push(frame), cancel: () => (pending.length = 0) },
  });
  let now = 0;
  const frame = () => {
    now += 16;
    pending.shift()?.(now);
  };
  const ready = () => {
    fake.fire('style.load');
    frame();
  };
  const named = (name: string) => events.filter(event => event.name === name).map(event => event.payload);
  return { map, fake, frame, ready, events, named, pending };
};

/**
 * What a source holds, as last set.
 *
 * @param fake - The stand-in.
 * @param source - The source.
 * @returns Its features.
 */
const featuresIn = (fake: ReturnType<typeof fakeMap>, source: string) => (fake.data.get(source) as FeatureCollection<never> | undefined)?.features ?? [];

describe('TransitMapUtils', () => {
  describe('openingOf', () => {
    const bounds: [[number, number], [number, number]] = [
      [0, 51],
      [1, 52],
    ];

    test('opens on a linked view as it is', () => {
      expect(openingOf({ center: [0.5, 51.5], zoom: 12 }, bounds, { top: 1, bottom: 2, left: 3, right: 4 }, { top: 0, bottom: 0, left: 0, right: 0 })).toEqual({
        center: [0.5, 51.5],
        zoom: 12,
      });
    });

    test('else fits the network clear of the padding above and below, narrow at the sides, and of every panel over the map', () => {
      expect(openingOf(undefined, bounds, { top: 10, bottom: 20, left: 300, right: 300 }, { top: 1, bottom: 2, left: 3, right: 4 })).toEqual({
        bounds,
        fitBoundsOptions: {
          padding: { top: 11, bottom: 22, left: OPENING_SIDE_PADDING + 3, right: OPENING_SIDE_PADDING + 4 },
          maxZoom: OPENING_MAX_ZOOM,
        },
      });
    });
  });
});

describe('TransitMap', () => {
  test("credits on the map its tiles and OpenStreetMap, as their licences ask, not the network's other sources", () => {
    const { map } = mapOf();
    expect(map.credits).toEqual([...DEFAULT_BASEMAP_CREDITS, OPENSTREETMAP_CREDIT]);
  });

  test('keeps props given before it is ready, and draws them all once its style loads', () => {
    const { map, fake, ready } = mapOf({ stationLabels: false });
    map.update({ selectedStation: 'b', viewMode: '3d' });
    expect(map.status).toBe('loading');
    expect(fake.moves.filter(move => move.kind === 'ease')).toEqual([]);
    ready();
    expect(map.status).toBe('ready');
    expect(fake.layers.get(LAYERS.labels)?.layout.visibility).toBe('none');
    expect(featuresIn(fake, SOURCES.selection)).toHaveLength(1);
    expect(fake.moves.some(move => move.kind === 'ease' && move.options.pitch === VIEW_3D_PITCH)).toBe(true);
  });

  test('flies to a station selected from the start, and no later prop moves the camera off it', () => {
    const { fake, ready } = mapOf({ selectedStation: 'c', cover: { top: 0, right: 0, bottom: 0, left: 340 } });
    ready();
    expect(fake.moves.at(-1)).toMatchObject({ kind: 'ease', target: [2 * 0.0144, 51.5] });
  });

  test('says nothing inside a call: what happens is delivered at the end of the frame, to listeners given at the start', () => {
    const { map, fake, frame, events } = mapOf({ overlay: { kind: 'reach', from: 'b' } });
    fake.fire('style.load');
    map.seek({ time: toTimestamp('1935-01-01') });
    expect(events).toEqual([]);
    frame();
    expect(events.map(event => event.name)).toEqual(expect.arrayContaining(['status', 'overlay', 'step', 'time']));
  });

  test('a listener may call the map: it runs after the call it heard of is done', () => {
    const calls: string[] = [];
    const { map, ready } = mapOf({}, { status: () => calls.push(`status while ${map.status}`) });
    ready();
    expect(calls).toEqual(['status while ready']);
  });

  test('tells the time once ready, with the network at that moment, never zeros', () => {
    const { frame, ready, named } = mapOf();
    frame();
    expect(named('time')).toEqual([]);
    ready();
    const [time] = named('time') as { stats: { stations: number } }[];
    expect(time?.stats.stations).toBeGreaterThan(0);
  });

  test('acts on what changed, and on nothing for the same props again', () => {
    const { map, fake, ready } = mapOf();
    ready();
    map.update({ viewMode: '3d' });
    const moves = fake.moves.length;
    const sends = JSON.stringify([...fake.sends]);
    map.update({ viewMode: '3d', stationLabels: true, theme: 'dark' });
    expect(fake.moves).toHaveLength(moves);
    expect(JSON.stringify([...fake.sends])).toBe(sends);
  });

  test("draws another network on the same map: the camera where it was, the clock at the new one's today, a plan's track once built", () => {
    const { map, fake, frame, ready, named } = mapOf();
    ready();
    map.seek({ time: toTimestamp('1905-01-01') });
    frame();
    const moves = fake.moves.length;
    map.update({ facts: NetworkFacts.create(tinyNetwork(), { plan: 'extension', today: toTimestamp('2026-01-01') }) });
    frame();
    expect(fake.moves).toHaveLength(moves);
    expect((named('time').at(-1) as { time: number }).time).toBe(toTimestamp('2026-01-01'));
    expect(featuresIn(fake, SOURCES.planned)).toHaveLength(0);
    map.seek('future');
    frame();
    expect(featuresIn(fake, SOURCES.planned).length).toBeGreaterThan(0);
  });

  test("hides the ring of a station the moment took off the map, says so, and rings it again when it is back: the prop is the app's", () => {
    const { map, fake, frame, ready, named } = mapOf({ selectedStation: 'c' });
    ready();
    expect(featuresIn(fake, SOURCES.selection)).toHaveLength(1);
    map.seek({ time: toTimestamp('1905-01-01') });
    frame();
    expect(named('selectionGone')).toEqual(['c']);
    expect(featuresIn(fake, SOURCES.selection)).toHaveLength(0);
    map.seek('today');
    frame();
    expect(featuresIn(fake, SOURCES.selection)).toHaveLength(1);
    expect(named('selectionGone')).toEqual(['c']);
  });

  test('works the overlay out again as the date moves on, and reports it', () => {
    const { map, frame, ready, named } = mapOf({ overlay: { kind: 'route', from: 'a', to: 'c', preference: 'fastest' } });
    ready();
    map.seek({ time: toTimestamp('1905-01-01') });
    frame();
    const results = named('overlay') as { kind: string; route: unknown }[];
    expect(results.at(0)?.route).not.toBeNull();
    expect(results.at(-1)).toEqual({ kind: 'route', route: null });
  });

  test('holds a step as its camera arrives until the map there is drawn, but never longer than it may', () => {
    /**
     * Frames from the first change's start until its line first grows, the map's tiles loading when told.
     *
     * @param loadedAfter - The frame, from the step's start, the tiles are all loaded on.
     * @returns The frames.
     */
    const framesToGrow = (loadedAfter: number) => {
      const { map, fake, frame, ready, named } = mapOf();
      ready();
      map.play();
      for (let tick = 0; tick < 400 && named('step').length === 0; tick++) frame();
      let frames = 0;
      for (; frames < 400 && named('stepProgress').length === 0; frames++) {
        fake.view.tilesLoaded = frames >= loadedAfter;
        frame();
      }
      return frames;
    };
    const drawn = framesToGrow(0);
    // Never loaded: it waits its longest, 1.5 s at 16 ms a frame, then grows anyway.
    expect(framesToGrow(Infinity) - drawn).toBeCloseTo((MAX_TILE_WAIT_SECONDS * 1000) / 16, -1);
    // Loaded half a second late: it waits about that, then grows at once.
    const late = framesToGrow(drawn + 30) - drawn;
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThanOrEqual(31);
  });

  test('takes it all down once: the map removed, no frames, no events, and every later call does nothing', () => {
    const { map, fake, frame, ready, events, pending } = mapOf();
    ready();
    const delivered = events.length;
    map.destroy();
    expect([map.status, fake.isRemoved(), pending.length]).toEqual(['destroyed', true, 0]);
    map.update({ viewMode: '3d' });
    map.seek('future');
    map.play();
    map.stop();
    map.zoomIn();
    map.destroy();
    fake.fire('click', { point: [0, 0] });
    frame();
    expect(events).toHaveLength(delivered);
  });
});
