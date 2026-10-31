import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../src/core/date.utils';
import type { FeatureCollection } from '../../src/layers/features.types';
import { LAYERS, SOURCES } from '../../src/layers/ids.constants';
import { NetworkModel } from '../../src/model/network.service';
import { VIEW_3D_PITCH } from '../../src/playback/camera.constants';
import { TransitMap } from '../../src/transitMap.service';
import { OPENING_MAX_ZOOM, OPENING_SIDE_PADDING } from '../../src/transitMap.constants';
import type { MapProps, TransitMapListeners } from '../../src/transitMap.types';
import { openingOf } from '../../src/transitMap.utils';
import { fakeMap } from '../support/factories/fakeMap.utils';
import { tinyNetwork } from '../support/factories/tinyNetwork.utils';

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
    model: NetworkModel.create(tinyNetwork(), { today: toTimestamp('2026-01-01') }),
    props,
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
