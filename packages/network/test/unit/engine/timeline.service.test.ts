import { toTimestamp } from '@railtime/core/date.utils';
import { byCodeUnits } from '@railtime/core/text.utils';
import { lineId, planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { engineOf } from '../../../src/engine/engine.utils';
import { NetworkIndex } from '../../../src/engine/index.service';
import { Timeline } from '../../../src/engine/timeline.service';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf } from '../../support/facts.utils';

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
    expect(first.lineSegments.map(lineSegment => lineSegment.line).toSorted(byCodeUnits)).toEqual(['pink', 'red']);
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

  test('closes a station for a spell and reopens it, its line running on through it', () => {
    const network = tinyNetwork();
    network.stations[stationId('b')] = { ...network.stations[stationId('b')]!, suspended: { [lineId('red')]: [{ from: '1915-03-15', until: '1926-07-19' }] } };
    const { timeline } = timelineOf(network);
    const closing = timeline.steps.find(step => step.kind === 'stationClose' && step.station === 'b');
    const reopening = timeline.steps.find(step => step.kind === 'infill' && step.station === 'b');
    expect(closing).toEqual(expect.objectContaining({ time: toTimestamp('1915-03-15'), lines: ['red'], temporary: true }));
    expect(reopening).toEqual(expect.objectContaining({ time: toTimestamp('1926-07-19'), lines: ['red'], reopening: true }));
    if (!closing || !reopening) throw new Error('B closes in 1915 and reopens in 1926');
    // Calls while its closing plays, so it can fade; not again until its reopening has played.
    expect(
      [closing.index, closing.index + 1, reopening.index, reopening.index + 1].map(cursor => timeline.servesStation(stationId('b'), lineId('red'), cursor)),
    ).toEqual([true, false, false, true]);
    expect(timeline.everServes(stationId('b'), lineId('red'))).toBe(true);
  });

  test('keeps an infill station off its line until it opens', () => {
    const { timeline } = timelineOf();
    expect(timeline.servesStation(stationId('c'), lineId('red'), timeline.cursorAt(toTimestamp('1915-01-01')))).toBe(false);
    expect(timeline.servesStation(stationId('c'), lineId('red'), timeline.cursorAt(toTimestamp('1920-06-01')))).toBe(true);
  });

  test('never stops a line at a station that opened after the line had left', () => {
    const { timeline } = timelineOf();
    expect(timeline.everServes(stationId('c'), lineId('blue'))).toBe(false);
    expect(timeline.servesStation(stationId('c'), lineId('blue'), timeline.cursorAt(toTimestamp('1935-01-01')))).toBe(false);
    expect(timeline.steps.filter(step => step.kind === 'infill')).toEqual([expect.objectContaining({ station: 'c', lines: ['red'] })]);
  });

  test('never stops a line at a station that closed before the line came', () => {
    const { timeline } = timelineOf();
    expect(timeline.everServes(stationId('d'), lineId('green'))).toBe(false);
    expect(timeline.everServes(stationId('c'), lineId('green'))).toBe(true);
  });

  test('stops a line calling at a closed station, still while its closing step plays', () => {
    const { timeline } = timelineOf();
    const closing = timeline.steps.find(step => step.kind === 'stationClose')!;
    expect(closing).toMatchObject({ station: 'd', lines: ['red'] });
    expect(timeline.servesStation(stationId('d'), lineId('red'), closing.index)).toBe(true);
    expect(timeline.servesStation(stationId('d'), lineId('red'), closing.index + 1)).toBe(false);
  });

  test('renames a station on the map, but not one renamed before it opened', () => {
    const { timeline } = timelineOf();
    expect(timeline.steps.filter(step => step.kind === 'rename')).toEqual([expect.objectContaining({ station: 'd', from: 'Old D', to: 'D' })]);
  });

  test('resolves aliases, switching to the line itself while its identity step plays', () => {
    const { timeline } = timelineOf();
    const identity = timeline.steps.find(step => step.kind === 'identity')!;
    expect(timeline.identityOf(lineId('pink'), identity.index)).toEqual({ id: 'red' });
    expect(timeline.identityOf(lineId('pink'), identity.index, true)).toEqual({ id: 'pink', previousId: 'red' });
    expect(timeline.identityOf(lineId('pink'), identity.index + 1)).toEqual({ id: 'pink' });
  });

  test("follows every dated step with a plan's, undated, in the plan's order", () => {
    const timeline = new Timeline(engineOf(factsOf(tinyNetwork(), planId('extension'))).index);
    const planned = timeline.steps.slice(timeline.datedCount);
    expect(planned.map(step => [step.kind, step.planned, step.time])).toEqual([
      ['open', true, Infinity],
      ['infill', true, Infinity],
    ]);
    expect(timeline.steps.slice(0, timeline.datedCount).every(step => !step.planned)).toBe(true);
    expect(timeline.cursorAt(toTimestamp('2999-01-01'))).toBe(timeline.datedCount);
  });

  test("grows a plan's line from an end, though its sections both leave its middle", () => {
    const network = planOnlyNetwork();
    // The red line A–B–C as two sections out of B: one way, then the other.
    network.plans![planId('first')]!.sections = [
      { line: lineId('red'), stations: [stationId('b'), stationId('c')] },
      { line: lineId('red'), stations: [stationId('b'), stationId('a')] },
    ];
    const { timeline } = engineOf(factsOf(network, planId('first')));
    const openings = timeline.steps.filter(step => step.kind === 'open');
    expect(openings).toHaveLength(1);
    // From A or from C, whichever is nearer the centre: B, the middle, is passed on the way.
    expect(timeline.growths.growthOf(openings[0]!).reach.map(reached => reached.station)[1]).toBe('b');
  });

  test("opens a plan's line where it forks a branch at a time, its way first", () => {
    const network = planOnlyNetwork();
    const first = network.plans![planId('first')]!;
    first.stations![stationId('d')] = { name: 'D', coordinate: [30.01, 50.005] };
    // A second section branching off the first at B, shorter than the way on to C.
    first.sections.push({ line: lineId('red'), stations: [stationId('b'), stationId('d')] });
    const { timeline } = engineOf(factsOf(network, planId('first')));
    const openings = timeline.steps.filter(step => step.kind === 'open');
    const parts = openings.map(step => step.segments.map(segment => `${segment.stationA}-${segment.stationB}`));
    // The longest way through first, two segments; then the branch left off it at B.
    expect(parts.map(part => part.length)).toEqual([2, 1]);
    expect(parts.flat().toSorted(byCodeUnits)).toEqual(['a-b', 'b-c', 'b-d']);
  });

  test("keeps a plan's station off its line until its section plays", () => {
    const timeline = new Timeline(engineOf(factsOf(tinyNetwork(), planId('extension'))).index);
    expect(timeline.servesStation(stationId('f'), lineId('red'), timeline.steps.length - 1)).toBe(false);
    expect(timeline.servesStation(stationId('f'), lineId('red'), timeline.steps.length)).toBe(true);
  });

  test('says a line segment has closed only after its closing step', () => {
    const { index, timeline } = timelineOf();
    const blue = index.lineSegments.find(lineSegment => lineSegment.line === 'blue')!;
    const closes = timeline.steps.findIndex(step => step.kind === 'close' && step.line === 'blue');
    expect([timeline.hasClosed(blue, closes), timeline.hasClosed(blue, closes + 1)]).toEqual([false, true]);
  });

  test("ends its dates on the last dated step, a plan's undated ones after it", () => {
    const { timeline } = timelineOf();
    expect(timeline.lastDate).toBe(toTimestamp('1990-01-01'));
    const planned = engineOf(factsOf(tinyNetwork(), planId('extension'))).timeline;
    expect(planned.lastDate).toBe(toTimestamp('1990-01-01'));
  });

  test('draws a line through each of its aliases in turn, as the next one while an identity step plays', () => {
    const network = tinyNetwork();
    network.lines[lineId('pink')]!.aliases = [
      { until: '1950-01-01', as: lineId('blue'), text: 'Pink drawn as blue' },
      { until: '1990-01-01', as: lineId('red'), text: 'Pink becomes its own line' },
    ];
    const { timeline } = timelineOf(network);
    const toBlue = timeline.steps.findIndex(step => step.kind === 'identity' && step.time === toTimestamp('1950-01-01'));
    expect(timeline.identityOf(lineId('pink'), toBlue - 1)).toEqual({ id: 'blue' });
    expect(timeline.identityOf(lineId('pink'), toBlue, true)).toEqual({ id: 'red', previousId: 'blue' });
    expect(timeline.identityOf(lineId('pink'), toBlue + 1)).toEqual({ id: 'red' });
  });

  test('opens a line on its own once its alias has ended, from the day it ends', () => {
    const network = tinyNetwork();
    network.segments[2]!.lines[lineId('pink')] = { open: '1990-01-01' };
    const { timeline } = timelineOf(network);
    const opens = timeline.steps.filter(step => step.kind === 'open' && step.time === toTimestamp('1990-01-01'));
    expect(opens.map(step => step.kind === 'open' && step.line)).toEqual(['pink']);
  });

  test("plays lines opening on one day in the network's order of lines", () => {
    const network = tinyNetwork();
    // Green on A – B, the first segment, the same day blue opens on B – C.
    network.segments[0]!.lines[lineId('green')] = { open: '1930-01-01' };
    const { timeline } = timelineOf(network);
    const opens = timeline.steps.filter(step => step.kind === 'open' && step.time === toTimestamp('1930-01-01'));
    expect(opens.map(step => step.kind === 'open' && step.line)).toEqual(['blue', 'green']);
  });

  test('never stops a line at a station it passes, though it runs through it', () => {
    const network = tinyNetwork();
    network.stations[stationId('b')] = { ...network.stations[stationId('b')]!, passes: [lineId('red')] };
    const { timeline } = timelineOf(network);
    expect(timeline.everServes(stationId('b'), lineId('red'))).toBe(false);
    expect(timeline.servesStation(stationId('b'), lineId('red'), timeline.steps.length)).toBe(false);
    expect(timeline.servesStation(stationId('b'), lineId('pink'), timeline.steps.length)).toBe(true);
  });

  test('renames no station once its track has closed', () => {
    const network = tinyNetwork();
    // E is only on blue's D – E, closed in 1950: renamed in 1960, it is off the map.
    network.stations[stationId('e')] = { name: 'E', coordinate: [4 * 0.0144, 51.5], formerNames: [{ name: 'Old E', until: '1960-01-01' }] };
    network.segments.push({
      stationA: stationId('d'),
      stationB: stationId('e'),
      coordinates: [
        [3 * 0.0144, 51.5],
        [4 * 0.0144, 51.5],
      ],
      lines: { [lineId('blue')]: { open: '1930-01-01', close: '1950-01-01' } },
    });
    const { timeline } = timelineOf(network);
    expect(timeline.steps.some(step => step.kind === 'rename' && step.station === 'e')).toBe(false);
  });

  test('renames a station through each of its former names in turn', () => {
    const network = tinyNetwork();
    network.stations[stationId('d')]!.formerNames = [
      { name: 'Older D', until: '1915-01-01' },
      { name: 'Old D', until: '1925-01-01' },
    ];
    const { timeline } = timelineOf(network);
    expect(timeline.steps.flatMap(step => (step.kind === 'rename' ? [[step.from, step.to]] : []))).toEqual([
      ['Older D', 'Old D'],
      ['Old D', 'D'],
    ]);
  });

  test('takes a station off the map once all its track has closed', () => {
    const network = tinyNetwork();
    network.stations[stationId('e')] = { name: 'E', coordinate: [4 * 0.0144, 51.5] };
    network.segments.push({
      stationA: stationId('d'),
      stationB: stationId('e'),
      lines: { [lineId('blue')]: { open: '1930-01-01', close: '1950-01-01' } },
      coordinates: [
        [3 * 0.0144, 51.5],
        [4 * 0.0144, 51.5],
      ],
    });
    const { timeline } = timelineOf(network);
    expect(timeline.stationsOnMap(timeline.cursorAt(toTimestamp('1935-01-01'))).has(stationId('e'))).toBe(true);
    expect(timeline.stationsOnMap(timeline.cursorAt(toTimestamp('1955-01-01'))).has(stationId('e'))).toBe(false);
  });

  test('closes a fork a branch at a time: the branch back to the fork, then the way it left', () => {
    const network = tinyNetwork();
    // Blue runs out of D, which stays on red, to E, forking there 2 km on to F and 1 km north to G.
    network.stations[stationId('e')] = { name: 'E', coordinate: [4 * 0.0144, 51.5] };
    network.stations[stationId('f')] = { name: 'F', coordinate: [6 * 0.0144, 51.5] };
    network.stations[stationId('g')] = { name: 'G', coordinate: [4 * 0.0144, 51.509] };
    const blue = { blue: { open: '1930-01-01', close: '1950-01-01' } };
    network.segments.push(
      {
        stationA: stationId('d'),
        stationB: stationId('e'),
        lines: blue,
        coordinates: [network.stations[stationId('d')]!.coordinate, network.stations[stationId('e')]!.coordinate],
      },
      {
        stationA: stationId('e'),
        stationB: stationId('f'),
        lines: blue,
        coordinates: [network.stations[stationId('e')]!.coordinate, network.stations[stationId('f')]!.coordinate],
      },
      {
        stationA: stationId('e'),
        stationB: stationId('g'),
        lines: blue,
        coordinates: [network.stations[stationId('e')]!.coordinate, network.stations[stationId('g')]!.coordinate],
      },
    );
    const { timeline } = timelineOf(network);
    const closures = timeline.steps.filter(step => step.kind === 'close' && step.lineSegments.some(({ segment }) => segment.stationA === 'e'));
    expect(
      closures.map(step => step.kind === 'close' && step.lineSegments.map(({ segment }) => `${segment.stationA}–${segment.stationB}`).toSorted(byCodeUnits)),
    ).toEqual([['e–g'], ['d–e', 'e–f']]);
  });

  test('stops a closing front only where its line called, not at a station it ran past', () => {
    const network = tinyNetwork();
    // Blue runs D – E – F from 1930 to 1950; E opens on it only in 1960, after it left.
    network.stations[stationId('e')] = { name: 'E', coordinate: [4 * 0.0144, 51.5], infill: { [lineId('blue')]: '1960-01-01' } };
    network.stations[stationId('f')] = { name: 'F', coordinate: [5 * 0.0144, 51.5] };
    for (const [stationA, stationB, from] of [
      [stationId('d'), stationId('e'), 3],
      [stationId('e'), stationId('f'), 4],
    ] as const)
      network.segments.push({
        stationA,
        stationB,
        lines: { [lineId('blue')]: { open: '1930-01-01', close: '1950-01-01' } },
        coordinates: [
          [from * 0.0144, 51.5],
          [(from + 1) * 0.0144, 51.5],
        ],
      });
    const { timeline } = timelineOf(network);
    const closure = timeline.steps.find(step => step.kind === 'close' && step.lineSegments.some(({ segment }) => segment.stationB === 'f'));
    if (closure?.kind !== 'close') throw new Error('blue closes D–F in 1950');
    expect(timeline.growths.retreatOf(closure).reach.map(reached => [reached.station, reached.isNew])).toEqual([
      ['d', false],
      ['e', false],
      ['f', true],
    ]);
  });
});

describe('Timeline, what the map draws', () => {
  const index = new NetworkIndex(tinyNetwork());
  const timeline = new Timeline(index);
  const on = (year: number) => timeline.cursorAt(Date.UTC(year, 6, 1));
  /** Red on the segment from C. */
  const redFromC = index.lineSegmentsOf(lineId('red')).find(({ segment }) => segment.stationA === 'c')!;

  test('says a line calls at a station only with its track open and the station a stop on it', () => {
    // Red's track reaches C in 1910, and C opens on it in 1920.
    expect(timeline.callsAt(redFromC, stationId('c'), on(1905))).toBe(false);
    expect(timeline.callsAt(redFromC, stationId('c'), on(1915))).toBe(false);
    expect(timeline.callsAt(redFromC, stationId('c'), on(1925))).toBe(true);
  });

  test('draws a line as its alias until it ends, then as itself', () => {
    expect(timeline.drawnAs(lineId('pink'), on(1935))).toBe('red');
    expect(timeline.drawnAs(lineId('pink'), on(1995))).toBe('pink');
    expect(timeline.drawnAs(lineId('red'), on(1935))).toBe('red');
  });

  test('lists the lines drawn as one: itself, and those drawn as it then', () => {
    expect(timeline.linesDrawnAs(lineId('red'), on(1935))).toEqual(['red', 'pink']);
    expect(timeline.linesDrawnAs(lineId('red'), on(1995))).toEqual(['red']);
    expect(timeline.linesDrawnAs(lineId('pink'), on(1935))).toEqual([]);
  });

  test('lists the lines calling at a station as drawn, each once, in side-by-side order', () => {
    expect(timeline.linesCallingAt(stationId('a'), on(1935))).toEqual(['red']);
    expect(timeline.linesCallingAt(stationId('b'), on(1935))).toEqual(['red', 'blue']);
    expect(timeline.linesCallingAt(stationId('a'), on(1995))).toEqual(['red', 'pink']);
    expect(timeline.linesCallingAt(stationId('c'), on(1915))).toEqual([]);
  });
});
