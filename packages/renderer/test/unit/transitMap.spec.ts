import { toTimestamp, YEAR_MS } from '@railtime/core/date.utils';
import { required } from '@railtime/core/required.utils';
import { engineOf } from '@railtime/network/engine.utils';
import { NetworkFacts } from '@railtime/network/facts.service';
import { TINY_WITH_HOLE } from '@railtime/network/testing/boundaries';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { LineId, Network } from '@railtime/schema/network.types';
import { lineId, planId, stationId } from '@railtime/schema/testing/ids';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, test } from 'vitest';
import { LAYERS, SOURCES, UNFOCUSED_OPACITY } from '../../src/layers/ids.constants';
import type { LineFeature } from '../../src/layers/snapshot.types';
import { DEFAULT_BASEMAP_CREDITS, OPENSTREETMAP_CREDIT, PALETTES } from '../../src/layers/theme.constants';
import { MINIMAP_SOURCES, MINIMAP_UPDATE_MS, MINIMAP_VIEWPORT_CLASS, MINIMAP_VIEWPORT_COLOR } from '../../src/minimap/minimap.constants';
import { VIEW_3D_PITCH } from '../../src/playback/camera.constants';
import { END_OVERVIEW_MS, MAX_TILE_WAIT_SECONDS } from '../../src/playback/playback.constants';
import { FAST_YEARS_PER_SECOND } from '../../src/playback/player.constants';
import { FIT_NETWORK_MS } from '../../src/transitMap.constants';
import { TransitMap } from '../../src/transitMap.service';
import type { MapProps, MapPropsUpdate, TransitMapListeners, TransitMapOptions } from '../../src/transitMap.types';
import { fakeMap } from '../support/factories/fakeMap.utils';

/**
 * The tiny network's map on a stand-in, with frames stepped by hand, and every event it delivers.
 *
 * @param props - Its props at first.
 * @param on - Its listeners, besides the one recording every event.
 * @param style - The basemap's layers.
 * @param minimapContainer - Where to draw a minimap, on a stand-in of its own; none without.
 * @param options - Its other options: where it opens, its credits.
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
    createMap: mapOptions => (minimapContainer && mapOptions.container === minimapContainer ? mini.map : fake.map),
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

describe('TransitMap', () => {
  describe('lines in focus', () => {
    /** The tiny network, with `green` drawn until 2000 as a line with no track of its own. */
    const networkWithAlias = (): Network => {
      const network = tinyNetwork();
      const green = lineId('green');
      const umbrella = lineId('umbrella');
      network.lines[umbrella] = { name: 'Umbrella', network: required(network.lines[green], 'green').network, mode: 'metro', color: '#123456', pseudo: true };
      network.lines[green] = {
        ...required(network.lines[green], 'green'),
        aliases: [{ until: '2000-01-01', as: umbrella, text: 'Green becomes its own line' }],
      };
      return network;
    };
    /**
     * The map on that network in 1985, while green is drawn as the other.
     *
     * @param focusedLines - The lines in focus.
     * @returns The map, what it is drawn on, and how it moves.
     */
    const focusedThen = (focusedLines: LineId[]) => {
      const opened = mapOf({ facts: NetworkFacts.create(networkWithAlias(), { today: toTimestamp('2026-01-01') }), focusedLines });
      opened.ready();
      opened.map.seek(opened.playheads.on(toTimestamp('1985-01-01')));
      opened.frame();
      return opened;
    };
    /**
     * What the lines' layer shows of a map brought forward.
     *
     * @param lines - The ids brought forward.
     * @returns The opacity it is set to.
     */
    const focusOn = (...lines: string[]) => ['case', ['in', ['get', 'line'], ['literal', lines]], 1, UNFOCUSED_OPACITY];
    /** The lines drawn on a map, by what their features say. */
    const linesDrawn = (fake: ReturnType<typeof fakeMap>) => fake.featuresIn<LineFeature>(SOURCES.lines).map(feature => feature.properties.line);

    test('matches what is drawn: the line a panel names, drawn for the line under it', () => {
      const { fake } = focusedThen([lineId('umbrella')]);
      expect(linesDrawn(fake)).toContain('umbrella');
      expect(linesDrawn(fake)).not.toContain('green');
      expect(fake.layers.get(LAYERS.lines)?.paint['line-opacity']).toEqual(focusOn('umbrella'));
    });

    test('takes a line by its own id too, while it is drawn as another', () => {
      const { fake } = focusedThen([lineId('green')]);
      expect(fake.layers.get(LAYERS.lines)?.paint['line-opacity']).toEqual(focusOn('umbrella'));
    });

    test('says two lines drawn as one once', () => {
      const { fake } = focusedThen([lineId('green'), lineId('umbrella')]);
      expect(fake.layers.get(LAYERS.lines)?.paint['line-opacity']).toEqual(focusOn('umbrella'));
    });

    test('follows the moment: a line comes forward as itself once it has parted', () => {
      const { map, fake, frame, playheads } = focusedThen([lineId('green')]);
      map.seek(playheads.on(toTimestamp('2005-01-01')));
      frame();
      expect(linesDrawn(fake)).toContain('green');
      expect(fake.layers.get(LAYERS.lines)?.paint['line-opacity']).toEqual(focusOn('green'));
    });

    test('runs the trains of what is drawn', () => {
      const { fake } = focusedThen([lineId('green')]);
      expect(fake.layers.get(LAYERS.trains)?.filter).toEqual(['in', ['get', 'line'], ['literal', ['umbrella']]]);
    });
  });

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

  test('draws planned track bold as its prop says, from the start and as it changes', () => {
    const { map, fake, ready } = mapOf({ boldPlans: true });
    ready();
    expect(fake.layers.get(LAYERS.planned)?.paint['line-opacity']).toBe(1);
    map.update({ boldPlans: false });
    expect(fake.layers.get(LAYERS.planned)?.paint['line-opacity']).toBeCloseTo(0.85);
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

  test("draws another network on the same map: the camera where it was, the clock where it rests, a plan's track built", () => {
    const { map, fake, frame, ready, named, playheads } = mapOf();
    ready();
    map.seek(playheads.on(toTimestamp('1905-01-01')));
    frame();
    const moves = fake.moves.length;
    const planned = NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today: toTimestamp('2026-01-01') });
    map.update({ facts: planned });
    frame();
    expect(fake.moves).toHaveLength(moves);
    expect(named('time').at(-1)).toMatchObject({ ...planned.playheads.end(), atRest: true, inPlan: true });
    expect(fake.featuresIn(SOURCES.planned).length).toBeGreaterThan(0);
  });

  test('stands on another network where its arrival says, in one update, whatever order it is given in', () => {
    const { map, fake, frame, ready, named } = mapOf();
    ready();
    const planned = NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today: toTimestamp('2026-01-01') });
    map.update({ arrival: { day: toTimestamp('1905-01-01') }, facts: planned });
    frame();
    expect(named('time').at(-1)).toMatchObject({ ...planned.playheads.on(toTimestamp('1905-01-01')), atRest: false, inPlan: false });
    expect(fake.featuresIn(SOURCES.planned)).toHaveLength(0);
  });

  test('moves nothing for an arrival alone: it is read as a network comes', () => {
    const { map, frame, ready, named, playheads } = mapOf();
    ready();
    const told = named('time').length;
    map.update({ arrival: { day: toTimestamp('1905-01-01') } });
    frame();
    expect(named('time')).toHaveLength(told);
    expect(named('time').at(-1)).toMatchObject(playheads.today());
  });

  test('opens where its arrival says, a change left drawn in part captioned', () => {
    const facts = NetworkFacts.create(tinyNetwork(), { today: toTimestamp('2026-01-01') });
    const moment = facts.playheads.moment(facts.playheads.after(3, 0.5));
    const { frame, ready, named } = mapOf({ facts, arrival: moment });
    ready();
    frame();
    expect(named('time')[0]).toMatchObject(facts.playheads.after(3, 0.5));
    expect(named('step').at(-1)).toEqual(facts.change(3));
  });

  test('opens a network with a plan on the plan built, as a page with no moment asked does', () => {
    const facts = NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today: toTimestamp('2026-01-01') });
    const { fake, ready, named } = mapOf({ facts });
    ready();
    expect(named('time')[0]).toMatchObject({ ...facts.playheads.end(), atRest: true });
    expect(fake.featuresIn(SOURCES.planned).length).toBeGreaterThan(0);
  });

  test('keeps a move made on a network given before it is ready, not only where its arrival says', () => {
    const { map, ready, named } = mapOf();
    const next = NetworkFacts.create(tinyNetwork(), { today: toTimestamp('2026-01-01'), plan: planId('extension') });
    map.update({ facts: next, arrival: null });
    const wanted = next.playheads.on(toTimestamp('1935-01-01'));
    map.seek(wanted);
    ready();
    expect(named('time').at(-1)).toMatchObject({ cursor: wanted.cursor, time: wanted.time });
  });

  test('takes up a network given before it is ready where its arrival says, a plan picked as the style loads built', () => {
    const { map, fake, ready, named } = mapOf();
    const planned = NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today: toTimestamp('2026-01-01') });
    map.update({ facts: planned, arrival: null });
    expect(map.status).toBe('loading');
    ready();
    expect(named('time')[0]).toMatchObject({ ...planned.playheads.end(), atRest: true, inPlan: true });
    expect(fake.featuresIn(SOURCES.planned).length).toBeGreaterThan(0);

    const dated = mapOf();
    dated.map.update({ facts: planned, arrival: { day: toTimestamp('1905-01-01') } });
    dated.ready();
    expect(dated.named('time')[0]).toMatchObject(planned.playheads.on(toTimestamp('1905-01-01')));
  });

  test('leaves the camera where it is as another network comes with an overlay open, the same overlay worked out on it', () => {
    const overlays: MapProps['overlay'][] = [
      { kind: 'route', from: stationId('a'), to: stationId('c'), option: 0 },
      { kind: 'reach', from: stationId('b') },
      { kind: 'coverage', metres: 800 },
    ];
    const planned = NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today: toTimestamp('2026-01-01') });
    for (const overlay of overlays) {
      const { map, fake, frame, ready, named } = mapOf({ overlay, boundary: TINY_WITH_HOLE });
      ready();
      frame();
      const moves = fake.moves.filter(move => move.kind === 'fit').length;
      expect(moves).toBe(1);
      const reports = named('overlay').length;
      map.update({ facts: planned });
      frame();
      expect(fake.moves.filter(move => move.kind === 'fit')).toHaveLength(moves);
      expect(named('overlay').length).toBeGreaterThan(reports);
      // Held across the network: a new subject on the new network frames as ever.
      map.update({ overlay: { kind: 'reach', from: stationId('a') } });
      expect(fake.moves.filter(move => move.kind === 'fit')).toHaveLength(moves + 1);
    }
  });

  test('takes trains off the map as another network comes with them turned off, in one update', () => {
    const { map, fake, frame, ready } = mapOf({ trains: true });
    ready();
    frame();
    expect(fake.featuresIn(SOURCES.trains).length).toBeGreaterThan(0);
    map.update({ facts: NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today: toTimestamp('2026-01-01') }), trains: false });
    frame();
    expect(fake.featuresIn(SOURCES.trains)).toEqual([]);
  });

  test('takes a change off the minimap as another network comes, however it was left drawn', () => {
    const { map, mini, frame, ready, playheads } = mapOf({}, {}, [], document.createElement('div'));
    ready();
    mini.fire('style.load');
    map.seek(playheads.after(1, 0.8));
    frame();
    frame();
    frame();
    expect(mini.featuresIn(MINIMAP_SOURCES.active).length).toBeGreaterThan(0);
    map.update({ facts: NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today: toTimestamp('2026-01-01') }) });
    frame();
    frame();
    frame();
    expect(mini.featuresIn(MINIMAP_SOURCES.active)).toEqual([]);
  });

  test('plays another network at the speed set, as the props have it', () => {
    const { map, frame, ready, named } = mapOf({ speed: 3 });
    ready();
    const another = NetworkFacts.create(tinyNetwork(), { plan: planId('extension'), today: toTimestamp('2026-01-01') });
    map.update({ facts: another });
    // Nine quiet years before green opens in 1970: the clock runs at its fastest.
    map.seek(another.playheads.on(toTimestamp('1961-01-01')));
    frame();
    map.play();
    frame();
    frame();
    const [before, after] = (named('time') as { time: number }[]).slice(-2);
    expect(((after?.time ?? 0) - (before?.time ?? 0)) / YEAR_MS).toBeCloseTo(3 * FAST_YEARS_PER_SECOND * 0.016, 3);
  });

  test('sends lines blending to the minimap no oftener than it takes them, by the clock of the frames', () => {
    const { map, fake, mini, frame, ready, facts } = mapOf({}, {}, [], document.createElement('div'));
    ready();
    mini.fire('style.load');
    const identity = engineOf(facts).timeline.steps.find(step => step.kind === 'identity')!;
    map.seek(facts.playheads.after(identity.index, 0.05));
    map.play();
    frame();
    const [lines, inset] = [fake.sends.get(SOURCES.lines) ?? 0, mini.sends.get(MINIMAP_SOURCES.lines) ?? 0];
    const frames = 30;
    for (let tick = 0; tick < frames; tick++) frame();
    expect((fake.sends.get(SOURCES.lines) ?? 0) - lines).toBe(frames);
    const sent = (mini.sends.get(MINIMAP_SOURCES.lines) ?? 0) - inset;
    expect(sent).toBeGreaterThan(0);
    expect(sent).toBeLessThanOrEqual(Math.ceil((frames * 16) / MINIMAP_UPDATE_MS));
  });

  test('is settled once what the camera looks at is drawn and nothing moves on its own', () => {
    const { map, fake, frame, ready, named, playheads } = mapOf();
    expect(map.settled).toBe(false);
    ready();
    frame();
    expect(map.settled).toBe(true);
    for (const [setting, unsettled] of [
      ['tilesLoaded', false],
      ['styleLoaded', false],
      ['moving', true],
    ] as const) {
      Object.assign(fake.view, { [setting]: unsettled });
      expect(map.settled).toBe(false);
      Object.assign(fake.view, { [setting]: !unsettled });
      expect(map.settled).toBe(true);
    }
    // A station pulsing moves on its own; it settles as the pulse runs out, the history paused.
    map.seek(playheads.before(1));
    map.play();
    for (let tick = 0; tick < 1000 && named('stepProgress').length === 0; tick++) frame();
    map.pause();
    frame();
    expect(map.settled).toBe(false);
    for (let tick = 0; tick < 500 && !map.settled; tick++) frame();
    expect(map.settled).toBe(true);
    map.destroy();
    expect(map.settled).toBe(false);
  });

  test('is drawn once its own tiles are, moving or pulsing, the minimap with it: what a held frame can wait for', () => {
    const { map, fake, mini, frame, ready } = mapOf({}, {}, [], document.createElement('div'));
    expect(map.drawn).toBe(false);
    ready();
    mini.fire('style.load');
    frame();
    expect(map.drawn).toBe(true);
    Object.assign(fake.view, { moving: true });
    expect([map.drawn, map.settled]).toEqual([true, false]);
    Object.assign(fake.view, { moving: false });
    for (const part of [fake, mini])
      for (const setting of ['tilesLoaded', 'styleLoaded']) {
        Object.assign(part.view, { [setting]: false });
        expect(map.drawn).toBe(false);
        Object.assign(part.view, { [setting]: true });
      }
    expect(map.drawn).toBe(true);
    map.destroy();
    expect(map.drawn).toBe(false);
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
    expect(fake.moves.at(-1)).toMatchObject({ kind: 'fit', target: engineOf(facts).index.bounds, options: { duration: FIT_NETWORK_MS } });
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
    expect(captions).toEqual([null, null, 8, null, 9, null, 10, null, null]);
    expect(named('end')).toHaveLength(1);
    expect(fake.moves.at(-1)).toMatchObject({ kind: 'fit', target: engineOf(facts).index.bounds, options: { duration: END_OVERVIEW_MS } });
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
    for (let tick = 0; tick < 50 && (named('step').at(-1) ?? null) === null; tick++) frame();
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
