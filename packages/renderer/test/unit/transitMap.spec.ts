import { toTimestamp } from '@railtime/core/date.utils';
import { NetworkFacts } from '@railtime/network/facts.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { planId, stationId } from '@railtime/schema/testing/ids';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, test } from 'vitest';
import { LAYERS, SOURCES } from '../../src/layers/ids.constants';
import { DEFAULT_BASEMAP_CREDITS, OPENSTREETMAP_CREDIT, PALETTES } from '../../src/layers/theme.constants';
import { MINIMAP_SOURCES, MINIMAP_VIEWPORT_CLASS, MINIMAP_VIEWPORT_COLOR } from '../../src/minimap/minimap.constants';
import { VIEW_3D_PITCH } from '../../src/playback/camera.constants';
import { END_OVERVIEW_MS, MAX_TILE_WAIT_SECONDS } from '../../src/playback/playback.constants';
import { FIT_NETWORK_MS, OPENING_MAX_ZOOM, OPENING_SIDE_PADDING } from '../../src/transitMap.constants';
import { TransitMap } from '../../src/transitMap.service';
import type { MapProps, MapPropsUpdate, TransitMapListeners, TransitMapOptions } from '../../src/transitMap.types';
import { openingOf } from '../../src/transitMap.utils';
import { fakeMap } from '../support/factories/fakeMap.utils';

/**
 * The tiny network's map on a stand-in, with frames stepped by hand, and every event it delivers.
 *
 * @param props - Its props at first.
 * @param on - Its listeners, besides the one recording every event.
 * @param style - The basemap's layers.
 * @param minimapContainer - Where to draw a minimap, on a stand-in of its own; none without.
 * @param options - Its other options: where it opens, its basemap, its credits.
 * @returns The map, the stand-ins, a frame stepper, the events delivered, in order, its network, and where its playheads are.
 */
const mapOf = (
  props: MapPropsUpdate = {},
  on: TransitMapListeners = {},
  style: LayerSpecification[] = [],
  minimapContainer?: HTMLElement,
  options: Partial<TransitMapOptions> = {},
) => {
  const fake = fakeMap(style);
  const mini = fakeMap();
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
  const facts = props.facts ?? NetworkFacts.create(tinyNetwork(), { today: toTimestamp('2026-01-01') });
  const map = new TransitMap({
    container: {} as HTMLElement,
    props: { ...props, facts },
    on: recordAll,
    ...options,
    ...(minimapContainer && { minimapContainer }),
    createMap: options => (minimapContainer && options.container === minimapContainer ? mini.map : fake.map),
    scheduler: {
      // The frame's id: where it waits.
      request: frame => {
        pending.push(frame);
        return pending.length;
      },
      cancel: () => (pending.length = 0),
    },
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
  return { map, fake, mini, frame, ready, events, named, pending, facts, playheads: facts.playheads };
};

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
    map.update({ selectedStation: stationId('b'), viewMode: '3d' });
    expect(map.status).toBe('loading');
    expect(fake.moves.filter(move => move.kind === 'ease')).toEqual([]);
    ready();
    expect(map.status).toBe('ready');
    expect(fake.layers.get(LAYERS.labels)?.layout.visibility).toBe('none');
    expect(fake.featuresIn(SOURCES.selection)).toHaveLength(1);
    expect(fake.moves.some(move => move.kind === 'ease' && move.options.pitch === VIEW_3D_PITCH)).toBe(true);
  });

  test("leaves the city's streets unnamed from the start, as it is set, and a theme does not name them again", () => {
    const style = [{ id: 'street-names', type: 'symbol', source: 'tiles', 'source-layer': 'transportation_name' }] as LayerSpecification[];
    const { map, fake, ready } = mapOf({ streetLabels: false }, {}, style);
    ready();
    expect(fake.layers.get('street-names')?.layout.visibility).toBe('none');
    map.update({ theme: 'light' });
    expect(fake.layers.get('street-names')?.layout.visibility).toBe('none');
    map.update({ streetLabels: true });
    expect(fake.layers.get('street-names')?.layout.visibility).toBe('visible');
  });

  test('keeps the default of a prop it is made with as undefined, as an update does', () => {
    const style = [{ id: 'street-names', type: 'symbol', source: 'tiles', 'source-layer': 'transportation_name' }] as LayerSpecification[];
    const { fake, ready } = mapOf({ streetLabels: undefined }, {}, style);
    ready();
    expect(fake.layers.get('street-names')?.layout.visibility).toBe('visible');
  });

  test('flies to a station selected from the start, and no later prop moves the camera off it', () => {
    const { fake, ready } = mapOf({ selectedStation: stationId('c'), cover: { top: 0, right: 0, bottom: 0, left: 340 } });
    ready();
    expect(fake.moves.at(-1)).toMatchObject({ kind: 'ease', target: [2 * 0.0144, 51.5] });
  });

  test('says nothing inside a call: what happens is delivered at the end of the frame, to listeners given at the start', () => {
    const { map, fake, frame, events, playheads } = mapOf({ overlay: { kind: 'reach', from: stationId('b') } });
    fake.fire('style.load');
    map.seek(playheads.on(toTimestamp('1935-01-01')));
    expect(events).toEqual([]);
    frame();
    expect(events.map(event => event.name)).toEqual(expect.arrayContaining(['status', 'overlay', 'step', 'time']));
  });

  test('a listener may call the map: it runs after the call it heard of is done', () => {
    const calls: string[] = [];
    const { map, ready } = mapOf(
      {},
      {
        status: () => {
          calls.push(`status while ${map.status}`);
        },
      },
    );
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
    const { map, fake, frame, ready, named, playheads } = mapOf();
    ready();
    map.seek(playheads.on(toTimestamp('1905-01-01')));
    frame();
    const moves = fake.moves.length;
    const planned = NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today: toTimestamp('2026-01-01') });
    map.update({ facts: planned });
    frame();
    expect(fake.moves).toHaveLength(moves);
    expect((named('time').at(-1) as { time: number }).time).toBe(toTimestamp('2026-01-01'));
    expect(fake.featuresIn(SOURCES.planned)).toHaveLength(0);
    map.seek(planned.playheads.end());
    frame();
    expect(fake.featuresIn(SOURCES.planned).length).toBeGreaterThan(0);
  });

  test("hides the ring of a station the moment took off the map, says so, and rings it again when it is back: the prop is the app's", () => {
    const { map, fake, frame, ready, named, playheads } = mapOf({ selectedStation: stationId('c') });
    ready();
    expect(fake.featuresIn(SOURCES.selection)).toHaveLength(1);
    map.seek(playheads.on(toTimestamp('1905-01-01')));
    frame();
    expect(named('selectionGone')).toEqual(['c']);
    expect(fake.featuresIn(SOURCES.selection)).toHaveLength(0);
    map.seek(playheads.today());
    frame();
    expect(fake.featuresIn(SOURCES.selection)).toHaveLength(1);
    expect(named('selectionGone')).toEqual(['c']);
  });

  test('stands on a change drawn in part as a seek leaves it: told as the playhead, captioned with the change', () => {
    const { map, frame, ready, named, playheads } = mapOf();
    ready();
    const halfway = playheads.after(1, 0.5);
    map.seek(halfway);
    frame();
    expect(named('time').at(-1)).toMatchObject({ ...halfway, progress: expect.closeTo(0.5) });
    expect(named('step').at(-1)).toMatchObject({ index: 1 });
    map.seek(playheads.after(2));
    frame();
    expect(named('step').at(-1)).toBeNull();
  });

  test('turned into 3D while a change plays, goes on drawing it as now seen, from as far as it had got', () => {
    const { map, frame, ready, named, playheads } = mapOf();
    ready();
    map.seek(playheads.after(1, 0.4));
    map.play();
    frame();
    const before = named('time').at(-1) as { cursor: number; progress: number };
    map.update({ viewMode: '3d' });
    frame();
    const after = named('time').at(-1) as { cursor: number; progress: number };
    // The same change, drawn on from where it was, at 3D's slower pace: a frame on, a little further.
    expect(after.cursor).toBe(before.cursor);
    expect(after.progress).toBeGreaterThanOrEqual(before.progress);
    expect(after.progress - before.progress).toBeLessThan(0.05);
  });

  test('works the overlay out again as the date moves on, and reports it', () => {
    const { map, frame, ready, named, playheads } = mapOf({ overlay: { kind: 'route', from: stationId('a'), to: stationId('c'), option: 0 } });
    ready();
    map.seek(playheads.on(toTimestamp('1905-01-01')));
    frame();
    const results = named('overlay') as { kind: string; routes: unknown[]; shown: number | null }[];
    expect(results.at(0)).toMatchObject({ kind: 'route', shown: 0 });
    expect(results.at(0)?.routes.length).toBeGreaterThan(0);
    expect(results.at(-1)).toEqual({ kind: 'route', routes: [], shown: null });
  });

  test('draws the way between two stations asked for, or the last there is on the date, and says which', () => {
    const { frame, ready, named, fake, facts } = mapOf({ overlay: { kind: 'route', from: stationId('a'), to: stationId('c'), option: 9 } });
    ready();
    frame();
    const ways = facts.asOf(facts.playheads.today()).routes(stationId('a'), stationId('c'));
    expect(ways.length).toBeGreaterThan(0);
    expect(named('overlay').at(-1)).toEqual({ kind: 'route', routes: ways, shown: ways.length - 1 });
    expect(fake.featuresIn(SOURCES.route).length).toBeGreaterThan(0);
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

  test('pauses where it is: the clock stands still until played again', () => {
    const { map, frame, ready, named, playheads } = mapOf();
    ready();
    map.seek(playheads.on(toTimestamp('1901-01-01')));
    map.play();
    for (let tick = 0; tick < 5; tick++) frame();
    map.pause();
    frame();
    const paused = named('time').at(-1) as { time: number; playing: boolean };
    for (let tick = 0; tick < 5; tick++) frame();
    expect(paused.playing).toBe(false);
    expect(named('time').at(-1)).toEqual(paused);
  });

  test('stops: pauses, and the camera goes back to the whole network', () => {
    const { map, fake, frame, ready, named, facts } = mapOf();
    ready();
    map.play();
    frame();
    map.stop();
    frame();
    expect(named('time').at(-1)).toMatchObject({ playing: false });
    expect(fake.moves.at(-1)).toMatchObject({ kind: 'fit', target: facts.engine.index.bounds, options: { duration: FIT_NETWORK_MS } });
  });

  test('skips the change drawn in part to its end, then, between changes, starts the next at once', () => {
    const { map, frame, ready, named, playheads } = mapOf();
    ready();
    map.seek(playheads.after(1, 0.5));
    map.skip();
    frame();
    expect(named('time').at(-1)).toMatchObject({ cursor: 2, progress: 0 });
    map.skip();
    frame();
    expect(named('step').at(-1)).toMatchObject({ index: 2 });
  });

  test('moves a year on or back from the date shown, with every change in between done or undone', () => {
    const { map, frame, ready, named, playheads } = mapOf();
    ready();
    map.seek(playheads.on(toTimestamp('1919-08-01')));
    map.stepYear(1);
    frame();
    expect(named('time').at(-1)).toMatchObject({ cursor: 3 });
    map.stepYear(-1);
    frame();
    expect(named('time').at(-1)).toMatchObject({ cursor: 2 });
  });

  test('goes back to just before the change before the last played, and plays it again if playing', () => {
    const { map, frame, ready, named, playheads } = mapOf();
    ready();
    map.seek(playheads.after(4));
    map.previousChange();
    frame();
    expect(named('time').at(-1)).toMatchObject(playheads.before(2));
    map.play();
    for (let tick = 0; tick < 5 && named('step').at(-1) === null; tick++) frame();
    expect(named('step').at(-1)).toMatchObject({ index: 2 });
  });

  test('zooms a step in and out, and jumps to a view at once', () => {
    const { map, fake, ready } = mapOf();
    ready();
    const zoom = fake.view.zoom;
    map.zoomIn();
    expect(fake.view.zoom).toBe(zoom + 1);
    map.zoomOut();
    expect(fake.view.zoom).toBe(zoom);
    map.jumpTo({ center: [0.01, 51.5], zoom: 13 });
    expect(fake.moves.at(-1)).toMatchObject({ kind: 'jump', target: [0.01, 51.5], options: { zoom: 13 } });
  });

  test('tells the app where it looks once a move ends', () => {
    const { fake, frame, ready, named } = mapOf();
    ready();
    Object.assign(fake.view, { center: [0.02, 51.4], zoom: 12 });
    fake.fire('moveend');
    frame();
    expect(named('view')).toEqual([{ center: [0.02, 51.4], zoom: 12 }]);
  });

  test('reports the station clicked, or none for a click away from any, once ready; and points at a station under the cursor', () => {
    const { fake, frame, ready, named } = mapOf();
    fake.rendered.push({ properties: { id: 'b' } });
    fake.fire('click', { point: [0, 0] });
    frame();
    expect(named('stationClick')).toEqual([]);
    ready();
    fake.fire('click', { point: [0, 0] });
    fake.rendered.length = 0;
    fake.fire('click', { point: [0, 0] });
    frame();
    expect(named('stationClick')).toEqual(['b', null]);
    fake.fire('mouseenter');
    expect(fake.canvas.style.cursor).toBe('pointer');
    fake.fire('mouseleave');
    expect(fake.canvas.style.cursor).toBe('');
  });

  test('captions each change while it plays, clears it before the next, and at the end tells so and shows the whole network', () => {
    const { map, fake, frame, ready, named, facts, playheads } = mapOf();
    ready();
    map.seek(playheads.before(8));
    map.play();
    for (let tick = 0; tick < 5000 && named('end').length === 0; tick++) frame();
    const captions = named('step').map(change => (change as { index: number } | null)?.index ?? null);
    expect(captions).toEqual([null, 8, null, 9, null, 10, null, null]);
    expect(named('end')).toHaveLength(1);
    expect(fake.moves.at(-1)).toMatchObject({ kind: 'fit', target: facts.engine.index.bounds, options: { duration: END_OVERVIEW_MS } });
  });

  test('draws the network on a minimap, frames another network on it, colours it with the theme, and takes it down with the map', () => {
    const container = document.createElement('div');
    const { map, mini, ready } = mapOf({}, {}, [], container);
    ready();
    mini.fire('style.load');
    expect(mini.featuresIn(MINIMAP_SOURCES.lines).length).toBeGreaterThan(0);
    const fits = mini.moves.length;
    map.update({ facts: NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today: toTimestamp('2026-01-01') }) });
    expect(mini.moves.slice(fits)).toEqual([expect.objectContaining({ kind: 'fit' })]);
    map.update({ theme: 'light' });
    const box = container.querySelector<HTMLElement>(`.${MINIMAP_VIEWPORT_CLASS}`);
    expect(box?.style.getPropertyValue(MINIMAP_VIEWPORT_COLOR)).toBe(PALETTES.light.viewport);
    map.destroy();
    expect([mini.isRemoved(), container.childElementCount]).toEqual([true, 0]);
  });

  test('takes it all down once: the map removed, no frames, no events, and every later call does nothing', () => {
    const { map, fake, frame, ready, events, pending, playheads } = mapOf();
    ready();
    const delivered = events.length;
    map.destroy();
    expect([map.status, fake.isRemoved(), pending.length]).toEqual(['destroyed', true, 0]);
    map.update({ viewMode: '3d' });
    map.seek(playheads.end());
    map.play(playheads.start());
    map.pause();
    map.stop();
    map.skip();
    map.stepYear(1);
    map.previousChange();
    map.zoomIn();
    map.zoomOut();
    map.fitNetwork();
    map.jumpTo({ center: [0, 0], zoom: 1 });
    map.destroy();
    fake.fire('click', { point: [0, 0] });
    frame();
    expect(events).toHaveLength(delivered);
    expect([fake.view.zoom, fake.moves.filter(move => move.kind === 'jump' && move.options.zoom === 1)]).toEqual([10, []]);
  });

  test('a listener may destroy the map: no frame is asked for after it', () => {
    const { map, ready, pending } = mapOf({}, { status: () => map.destroy() });
    ready();
    expect([map.status, pending.length]).toEqual(['destroyed', 0]);
  });

  test('installs its layers once, however often the style says it loaded', () => {
    const { fake, ready } = mapOf();
    ready();
    const layers = fake.layers.size;
    fake.fire('style.load');
    expect(fake.layers.size).toBe(layers);
  });

  test('opens on a linked view as it is, its centre in the middle of what the panels leave; else fits the network clear of them', () => {
    const cover = { top: 0, right: 0, bottom: 0, left: 300 };
    const linked = mapOf({ cover }, {}, [], undefined, { view: { center: [0.01, 51.5], zoom: 13 } });
    expect([linked.fake.view.cover, linked.fake.moves]).toEqual([cover, []]);
    const fitted = mapOf({ cover });
    expect(fitted.fake.moves).toEqual([expect.objectContaining({ kind: 'jump', options: expect.objectContaining({ padding: cover }) })]);
  });

  test('credits only OpenStreetMap on another basemap, whose credits are its own', () => {
    const { map } = mapOf({}, {}, [], undefined, { basemap: 'https://tiles.invalid/style.json', attributionControl: false });
    expect(map.credits).toEqual([OPENSTREETMAP_CREDIT]);
  });

  test('plays from a playhead given, captioning the change it starts in', () => {
    const { map, frame, ready, named, playheads } = mapOf();
    ready();
    map.play(playheads.after(2, 0.3));
    frame();
    expect(named('step').at(-1)).toMatchObject({ index: 2 });
    expect(named('time').at(-1)).toMatchObject({ cursor: 2, playing: true });
  });

  test('turned into 3D on its way to a change, flies to where the change starts', () => {
    const { map, fake, frame, ready, named, playheads } = mapOf();
    ready();
    map.seek(playheads.before(1));
    map.play();
    for (let tick = 0; tick < 50 && named('step').at(-1) == null; tick++) frame();
    const moves = fake.moves.length;
    map.update({ viewMode: '3d' });
    expect(fake.moves.slice(moves).filter(move => move.kind === 'ease' || move.kind === 'fit').length).toBeGreaterThan(1);
  });

  test('a free camera starts each change after a beat, the camera left where it is', () => {
    /**
     * Frames from playing until the first change grows.
     *
     * @param camera - How the camera moves.
     * @returns The frames, and whether the camera moved meanwhile.
     */
    const framesToGrow = (camera: MapProps['camera']) => {
      const { map, fake, frame, ready, named, playheads } = mapOf({ camera });
      ready();
      map.seek(playheads.before(1));
      const moves = fake.moves.length;
      map.play();
      let frames = 0;
      for (; frames < 1000 && named('stepProgress').length === 0; frames++) frame();
      return { frames, moved: fake.moves.length > moves };
    };
    const free = framesToGrow('free');
    const follow = framesToGrow('follow');
    expect(free.moved).toBe(false);
    expect(follow.moved).toBe(true);
    expect(free.frames).toBeLessThan(follow.frames);
  });
});
