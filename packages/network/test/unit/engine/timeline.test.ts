import { describe, expect, test } from 'vitest';
import { toTimestamp } from '@railtime/core/date.utils';
import { NetworkIndex } from '../../../src/engine/index.service';
import { Timeline } from '../../../src/engine/timeline.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf } from '../../support/facts.utils';
import type { LineSegment, TrackSegment } from '../../../src/engine/engine.types';
import { forkedParts, planGrowth } from '../../../src/engine/timeline.utils';

const timelineOf = (network = tinyNetwork()) => {
  const index = new NetworkIndex(network);
  return { index, timeline: new Timeline(index) };
};

describe('Timeline', () => {
  test('orders steps by date, identity changes first on a shared date', () => {
    const { timeline } = timelineOf();
    expect(timeline.steps.map(step => [new Date(step.time).getUTCFullYear(), step.kind])).toEqual([
      [1900, 'open'],
      [1910, 'open'],
      [1920, 'infill'],
      [1925, 'rename'],
      [1930, 'open'],
      [1940, 'close'],
      [1945, 'open'],
      [1950, 'close'],
      [1960, 'stationClose'],
      [1970, 'open'],
      [1990, 'identity'],
    ]);
  });

  test('opens lines drawn as the same line together', () => {
    const { timeline } = timelineOf();
    const first = timeline.steps[0];
    if (first?.kind !== 'open') throw new Error('expected the first step to open a line');
    expect(first.line).toBe('red');
    expect(first.lineSegments.map(lineSegment => lineSegment.line).sort()).toEqual(['pink', 'red']);
  });

  test('puts the cursor after every step on or before a day', () => {
    const { timeline } = timelineOf();
    expect(timeline.cursorAt(toTimestamp('1899-12-31'))).toBe(0);
    expect(timeline.cursorAt(toTimestamp('1900-01-01'))).toBe(1);
    expect(timeline.cursorAt(toTimestamp('2026-01-01'))).toBe(timeline.steps.length);
  });

  test('opens and closes line segments by cursor, each period of a suspended line on its own', () => {
    const { index, timeline } = timelineOf();
    const [before, after] = index.lineSegments.filter(lineSegment => lineSegment.line === 'blue');
    expect(timeline.isOpen(before!, timeline.cursorAt(toTimestamp('1929-12-31')))).toBe(false);
    expect(timeline.isOpen(before!, timeline.cursorAt(toTimestamp('1935-01-01')))).toBe(true);
    expect(timeline.hasClosed(before!, timeline.cursorAt(toTimestamp('1940-01-01')))).toBe(true);
    expect(timeline.isOpen(after!, timeline.cursorAt(toTimestamp('1940-01-01')))).toBe(false);
    expect(timeline.isOpen(after!, timeline.cursorAt(toTimestamp('1945-01-01')))).toBe(true);
    expect(timeline.hasClosed(after!, timeline.cursorAt(toTimestamp('1950-01-01')))).toBe(true);
  });

  test('keeps an infill station off its line until it opens', () => {
    const { timeline } = timelineOf();
    expect(timeline.servesStation('c', 'red', timeline.cursorAt(toTimestamp('1915-01-01')))).toBe(false);
    expect(timeline.servesStation('c', 'red', timeline.cursorAt(toTimestamp('1920-06-01')))).toBe(true);
  });

  test('never stops a line at a station that opened after the line had left', () => {
    const { timeline } = timelineOf();
    expect(timeline.everServes('c', 'blue')).toBe(false);
    expect(timeline.servesStation('c', 'blue', timeline.cursorAt(toTimestamp('1935-01-01')))).toBe(false);
    expect(timeline.steps.filter(step => step.kind === 'infill')).toEqual([expect.objectContaining({ station: 'c', lines: ['red'] })]);
  });

  test('never stops a line at a station that closed before the line came', () => {
    const { timeline } = timelineOf();
    expect(timeline.everServes('d', 'green')).toBe(false);
    expect(timeline.everServes('c', 'green')).toBe(true);
  });

  test('stops a line calling at a closed station, still while its closing step plays', () => {
    const { timeline } = timelineOf();
    const closing = timeline.steps.find(step => step.kind === 'stationClose')!;
    expect(closing).toMatchObject({ station: 'd', lines: ['red'] });
    expect(timeline.servesStation('d', 'red', closing.index)).toBe(true);
    expect(timeline.servesStation('d', 'red', closing.index + 1)).toBe(false);
  });

  test('renames a station on the map, but not one renamed before it opened', () => {
    const { timeline } = timelineOf();
    expect(timeline.steps.filter(step => step.kind === 'rename')).toEqual([expect.objectContaining({ station: 'd', from: 'Old D', to: 'D' })]);
  });

  test('resolves aliases, switching to the line itself while its identity step plays', () => {
    const { timeline } = timelineOf();
    const identity = timeline.steps.find(step => step.kind === 'identity')!;
    expect(timeline.identityOf('pink', identity.index)).toEqual({ id: 'red' });
    expect(timeline.identityOf('pink', identity.index, true)).toEqual({ id: 'pink', previousId: 'red' });
    expect(timeline.identityOf('pink', identity.index + 1)).toEqual({ id: 'pink' });
  });

  test("follows every dated step with a plan's, undated, in the plan's order", () => {
    const timeline = new Timeline(factsOf(tinyNetwork(), 'extension').engine.index);
    const planned = timeline.steps.slice(timeline.datedCount);
    expect(planned.map(step => [step.kind, step.planned, step.time])).toEqual([
      ['open', true, Infinity],
      ['infill', true, Infinity],
    ]);
    expect(timeline.steps.slice(0, timeline.datedCount).every(step => !step.planned)).toBe(true);
    expect(timeline.cursorAt(toTimestamp('2999-01-01'))).toBe(timeline.datedCount);
  });

  test("keeps a plan's station off its line until its section plays", () => {
    const timeline = new Timeline(factsOf(tinyNetwork(), 'extension').engine.index);
    expect(timeline.servesStation('f', 'red', timeline.steps.length - 1)).toBe(false);
    expect(timeline.servesStation('f', 'red', timeline.steps.length)).toBe(true);
  });

  test('tells the step a line segment opens and closes at, and that it has closed only after its closing step', () => {
    const { index, timeline } = timelineOf();
    const blue = index.lineSegments.find(lineSegment => lineSegment.line === 'blue')!;
    const opens = timeline.steps.findIndex(step => step.kind === 'open' && step.line === 'blue');
    const closes = timeline.steps.findIndex(step => step.kind === 'close' && step.line === 'blue');
    expect(timeline.steps.map((_, cursor) => timeline.opensAt(blue, cursor))).toEqual(timeline.steps.map((_, cursor) => cursor === opens));
    expect(timeline.steps.map((_, cursor) => timeline.closesAt(blue, cursor))).toEqual(timeline.steps.map((_, cursor) => cursor === closes));
    expect([timeline.hasClosed(blue, closes), timeline.hasClosed(blue, closes + 1)]).toEqual([false, true]);
  });

  test("ends its dates on the last dated step, a plan's undated ones after it", () => {
    const { timeline } = timelineOf();
    expect(timeline.lastDate).toBe(toTimestamp('1990-01-01'));
    const planned = factsOf(tinyNetwork(), 'extension').engine.timeline;
    expect(planned.lastDate).toBe(toTimestamp('1990-01-01'));
  });

  test('draws a line through each of its aliases in turn, as the next one while an identity step plays', () => {
    const network = tinyNetwork();
    network.lines.pink!.aliases = [
      { until: '1950-01-01', as: 'blue', text: 'Pink drawn as blue' },
      { until: '1990-01-01', as: 'red', text: 'Pink becomes its own line' },
    ];
    const { timeline } = timelineOf(network);
    const toBlue = timeline.steps.findIndex(step => step.kind === 'identity' && step.time === toTimestamp('1950-01-01'));
    expect(timeline.identityOf('pink', toBlue - 1)).toEqual({ id: 'blue' });
    expect(timeline.identityOf('pink', toBlue, true)).toEqual({ id: 'red', previousId: 'blue' });
    expect(timeline.identityOf('pink', toBlue + 1)).toEqual({ id: 'red' });
  });

  test('opens a line on its own once its alias has ended, from the day it ends', () => {
    const network = tinyNetwork();
    network.segments[2]!.lines.pink = { open: '1990-01-01' };
    const { timeline } = timelineOf(network);
    const opens = timeline.steps.filter(step => step.kind === 'open' && step.time === toTimestamp('1990-01-01'));
    expect(opens.map(step => step.kind === 'open' && step.line)).toEqual(['pink']);
  });

  test("plays lines opening on one day in the network's order of lines", () => {
    const network = tinyNetwork();
    // Green on A – B, the first segment, the same day blue opens on B – C.
    network.segments[0]!.lines.green = { open: '1930-01-01' };
    const { timeline } = timelineOf(network);
    const opens = timeline.steps.filter(step => step.kind === 'open' && step.time === toTimestamp('1930-01-01'));
    expect(opens.map(step => step.kind === 'open' && step.line)).toEqual(['blue', 'green']);
  });

  test('never stops a line at a station it passes, though it runs through it', () => {
    const network = tinyNetwork();
    network.stations.b = { ...network.stations.b!, passes: ['red'] };
    const { timeline } = timelineOf(network);
    expect(timeline.everServes('b', 'red')).toBe(false);
    expect(timeline.servesStation('b', 'red', timeline.steps.length)).toBe(false);
    expect(timeline.servesStation('b', 'pink', timeline.steps.length)).toBe(true);
  });

  test('renames no station once its track has closed', () => {
    const network = tinyNetwork();
    // E is only on blue's D – E, closed in 1950: renamed in 1960, it is off the map.
    network.stations.e = { name: 'E', coordinate: [4 * 0.0144, 51.5], formerNames: [{ name: 'Old E', until: '1960-01-01' }] };
    network.segments.push({
      stationA: 'd',
      stationB: 'e',
      coordinates: [
        [3 * 0.0144, 51.5],
        [4 * 0.0144, 51.5],
      ],
      lines: { blue: { open: '1930-01-01', close: '1950-01-01' } },
    });
    const { timeline } = timelineOf(network);
    expect(timeline.steps.some(step => step.kind === 'rename' && step.station === 'e')).toBe(false);
  });

  test('renames a station through each of its former names in turn', () => {
    const network = tinyNetwork();
    network.stations.d!.formerNames = [
      { name: 'Older D', until: '1915-01-01' },
      { name: 'Old D', until: '1925-01-01' },
    ];
    const { timeline } = timelineOf(network);
    expect(timeline.steps.filter(step => step.kind === 'rename').map(step => step.kind === 'rename' && [step.from, step.to])).toEqual([
      ['Older D', 'Old D'],
      ['Old D', 'D'],
    ]);
  });

  test('takes a station off the map once all its track has closed', () => {
    const network = tinyNetwork();
    network.stations.e = { name: 'E', coordinate: [4 * 0.0144, 51.5] };
    network.segments.push({
      stationA: 'd',
      stationB: 'e',
      lines: { blue: { open: '1930-01-01', close: '1950-01-01' } },
      coordinates: [
        [3 * 0.0144, 51.5],
        [4 * 0.0144, 51.5],
      ],
    });
    const { timeline } = timelineOf(network);
    expect(timeline.stationsOnMap(timeline.cursorAt(toTimestamp('1935-01-01'))).has('e')).toBe(true);
    expect(timeline.stationsOnMap(timeline.cursorAt(toTimestamp('1955-01-01'))).has('e')).toBe(false);
  });

  test('grows an opening out of the stations on the map before it, worked out once, new only where it opens a station', () => {
    const { index, timeline } = timelineOf();
    const extension = timeline.steps.find(step => step.kind === 'open' && step.segments.some(segment => segment.stationB === 'c' || segment.stationA === 'c'));
    if (extension?.kind !== 'open') throw new Error('the tiny network extends red to C');
    const growth = timeline.growthOf(extension);
    const planned = planGrowth(extension.segments, timeline.stationsOnMap(extension.index), station => index.coordOf(station), index.centre);
    expect(growth.plans).toEqual(planned.plans);
    // B was on the map; red runs through C from 1910 but calls there only from 1920: D alone is new.
    expect(growth.reach.map(reached => [reached.station, reached.isNew])).toEqual([
      ['b', false],
      ['c', false],
      ['d', true],
    ]);
    expect(planned.reach.find(reached => reached.station === 'c')?.isNew).toBe(true);
    expect(timeline.growthOf(extension)).toBe(growth);
  });

  test('retracts a closure back to the stations still on the map after it, worked out once, new where a station leaves', () => {
    const network = tinyNetwork();
    network.stations.e = { name: 'E', coordinate: [4 * 0.0144, 51.5] };
    network.segments.push({
      stationA: 'd',
      stationB: 'e',
      lines: { blue: { open: '1930-01-01', close: '1950-01-01' } },
      coordinates: [
        [3 * 0.0144, 51.5],
        [4 * 0.0144, 51.5],
      ],
    });
    const { timeline } = timelineOf(network);
    const closure = timeline.steps.find(step => step.kind === 'close' && step.lineSegments.some(({ segment }) => segment.stationB === 'e'));
    if (closure?.kind !== 'close') throw new Error('blue closes D–E in 1950');
    const retreat = timeline.retreatOf(closure);
    // Played backwards, its front runs from E back to D, which stays on red.
    const toE = retreat.plans.find(plan => plan.segment.stationB === 'e');
    expect(toE?.fromStationA).toBe(true);
    expect(retreat.reach.filter(reached => reached.isNew).map(reached => reached.station)).toEqual(['e']);
    expect(timeline.retreatOf(closure)).toBe(retreat);
  });

  test('closes a fork a branch at a time: the branch back to the fork, then the way it left', () => {
    const network = tinyNetwork();
    // Blue runs out of D, which stays on red, to E, forking there 2 km on to F and 1 km north to G.
    network.stations.e = { name: 'E', coordinate: [4 * 0.0144, 51.5] };
    network.stations.f = { name: 'F', coordinate: [6 * 0.0144, 51.5] };
    network.stations.g = { name: 'G', coordinate: [4 * 0.0144, 51.509] };
    const blue = { blue: { open: '1930-01-01', close: '1950-01-01' } };
    network.segments.push(
      { stationA: 'd', stationB: 'e', lines: blue, coordinates: [network.stations.d!.coordinate, network.stations.e.coordinate] },
      { stationA: 'e', stationB: 'f', lines: blue, coordinates: [network.stations.e.coordinate, network.stations.f.coordinate] },
      { stationA: 'e', stationB: 'g', lines: blue, coordinates: [network.stations.e.coordinate, network.stations.g.coordinate] },
    );
    const { timeline } = timelineOf(network);
    const closures = timeline.steps.filter(step => step.kind === 'close' && step.lineSegments.some(({ segment }) => segment.stationA === 'e'));
    expect(closures.map(step => step.kind === 'close' && step.lineSegments.map(({ segment }) => `${segment.stationA}–${segment.stationB}`).sort())).toEqual([
      ['e–g'],
      ['d–e', 'e–f'],
    ]);
  });

  test('stops a closing front only where its line called, not at a station it ran past', () => {
    const network = tinyNetwork();
    // Blue runs D – E – F from 1930 to 1950; E opens on it only in 1960, after it left.
    network.stations.e = { name: 'E', coordinate: [4 * 0.0144, 51.5], infill: { blue: '1960-01-01' } };
    network.stations.f = { name: 'F', coordinate: [5 * 0.0144, 51.5] };
    for (const [stationA, stationB, from] of [
      ['d', 'e', 3],
      ['e', 'f', 4],
    ] as const)
      network.segments.push({
        stationA,
        stationB,
        lines: { blue: { open: '1930-01-01', close: '1950-01-01' } },
        coordinates: [
          [from * 0.0144, 51.5],
          [(from + 1) * 0.0144, 51.5],
        ],
      });
    const { timeline } = timelineOf(network);
    const closure = timeline.steps.find(step => step.kind === 'close' && step.lineSegments.some(({ segment }) => segment.stationB === 'f'));
    if (closure?.kind !== 'close') throw new Error('blue closes D–F in 1950');
    expect(timeline.retreatOf(closure).reach.map(reached => [reached.station, reached.isNew])).toEqual([
      ['d', false],
      ['e', false],
      ['f', true],
    ]);
  });
});

/**
 * A segment of a made-up stretch, as long as given: growth reads only its ends and length.
 *
 * @param index - Its id.
 * @param stationA - One end.
 * @param stationB - The other.
 * @param lengthKm - Its length.
 * @returns The segment.
 */
const track = (index: number, stationA: string, stationB: string, lengthKm: number): TrackSegment => ({
  index,
  stationA,
  stationB,
  coordinates: [],
  reversedCoordinates: [],
  distances: [],
  reversedDistances: [],
  lengthKm,
  travel: 1,
});

/**
 * A line's period on a made-up segment: what splitting a stretch reads is its track.
 *
 * @param segment - The segment.
 * @returns The line segment.
 */
const onLine = (segment: TrackSegment): LineSegment => ({ segment, line: 'red', opens: 0, closes: null, section: null, previous: null, next: null });

describe('TimelineUtils', () => {
  describe('planGrowth', () => {
    test('grows out of stations already on the map, reaching new ones in order', () => {
      const { index } = factsOf(tinyNetwork()).engine;
      const growth = planGrowth(index.segments.slice(1), new Set(['a', 'b']), station => index.coordOf(station), index.centre);
      expect(growth.reach.map(reached => [reached.station, reached.isNew])).toEqual([
        ['b', false],
        ['c', true],
        ['d', true],
      ]);
      expect(growth.totalKm).toBeCloseTo(2, 0);
    });

    test('grows an extension out of its own line, though its other end meets another line nearer the centre', () => {
      // West on the line extended, East on another line only; the centre by East.
      const segments = [track(0, 'west', 'middle', 1), track(1, 'middle', 'east', 1)];
      const placeOf = (station: string): [number, number] => [{ west: 0, middle: 1, east: 2 }[station] ?? 0, 0];
      const growth = planGrowth(segments, new Set(['west', 'east']), placeOf, [2, 0], new Set(['west']));
      expect(growth.reach.map(reached => reached.station)).toEqual(['west', 'middle', 'east']);
    });

    test('grows one way between two stations already on the map, from the one nearer the centre', () => {
      // A gap filled: West and East on the map, Middle new between them; the centre by East.
      const segments = [track(0, 'west', 'middle', 1), track(1, 'middle', 'east', 1)];
      const placeOf = (station: string): [number, number] => [{ west: 0, middle: 1, east: 2 }[station] ?? 0, 0];
      const growth = planGrowth(segments, new Set(['west', 'east']), placeOf, [2, 0]);
      expect(growth.reach.map(reached => reached.station)).toEqual(['east', 'middle', 'west']);
      expect(growth.plans.map(plan => [plan.fromStationA, plan.startKm])).toEqual([
        [false, 1],
        [false, 0],
      ]);
      expect(growth.totalKm).toBe(2);
    });

    test('grows a new line crossing the network from its end nearer the centre, through the station they share, not out of it', () => {
      const segments = [track(0, 'north', 'cross', 1), track(1, 'cross', 'south', 1)];
      const placeOf = (station: string): [number, number] => [0, { north: 2, cross: 1, south: 0 }[station] ?? 0];
      const growth = planGrowth(segments, new Set(['cross']), placeOf, [0, 0]);
      expect(growth.reach.map(reached => [reached.station, reached.isNew])).toEqual([
        ['south', true],
        ['cross', false],
        ['north', true],
      ]);
    });

    test('grows a fork from its one start, its branches side by side, each segment from its nearer end', () => {
      // Out of O, on the map: Near 1 km, then Far 1 km on and Beyond 3 km on, each listed from its far end.
      const segments = [track(0, 'o', 'near', 1), track(1, 'far', 'near', 1), track(2, 'beyond', 'near', 3)];
      const growth = planGrowth(segments, new Set(['o']), () => [0, 0], [0, 0]);
      expect(growth.reach).toEqual([
        { station: 'o', km: 0, isNew: false },
        { station: 'near', km: 1, isNew: true },
        { station: 'far', km: 2, isNew: true },
        { station: 'beyond', km: 4, isNew: true },
      ]);
      expect(growth.plans.map(plan => [plan.fromStationA, plan.startKm])).toEqual([
        [true, 0],
        [false, 1],
        [false, 1],
      ]);
      expect(growth.totalKm).toBe(4);
    });

    test('grows a loop, which has no end, from its station on the map, each way round by the shorter', () => {
      // O on the map; P 1 km one way, Q 2 km the other, P–Q 2 km.
      const segments = [track(0, 'o', 'p', 1), track(1, 'p', 'q', 2), track(2, 'q', 'o', 2)];
      const growth = planGrowth(segments, new Set(['o']), () => [0, 0], [0, 0]);
      expect(growth.reach.map(reached => [reached.station, reached.km])).toEqual([
        ['o', 0],
        ['p', 1],
        ['q', 2],
      ]);
    });

    test('starts a stretch that touches nothing from its end nearest the centre', () => {
      const { index } = factsOf(tinyNetwork()).engine;
      const growth = planGrowth(index.segments, new Set(), station => index.coordOf(station), [0.05, 51.5]);
      expect(growth.reach[0]?.station).toBe('d');
    });
  });

  describe('forkedParts', () => {
    test('opens a fork as the longest way from its start, then each branch from where it leaves', () => {
      // Out of O, on the map: Near 1 km, then Far 1 km on and Beyond 3 km on.
      const fork = [track(0, 'o', 'near', 1), track(1, 'far', 'near', 1), track(2, 'beyond', 'near', 3)].map(onLine);
      const parts = forkedParts(fork, new Set(['o']), () => [0, 0], [0, 0]);
      expect(parts).toEqual([[fork[0], fork[2]], [fork[1]]]);
    });

    test('keeps a stretch with no fork, and a loop, which joins its way twice, in one part', () => {
      const line = [track(0, 'o', 'p', 1), track(1, 'p', 'q', 1)].map(onLine);
      expect(forkedParts(line, new Set(['o']), () => [0, 0], [0, 0])).toEqual([line]);
      const loop = [track(0, 'o', 'p', 1), track(1, 'p', 'q', 2), track(2, 'q', 'o', 2)].map(onLine);
      expect(forkedParts(loop, new Set(['o']), () => [0, 0], [0, 0])).toHaveLength(1);
    });
  });
});
