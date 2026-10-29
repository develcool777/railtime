import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/model/date.utils';
import { NetworkIndex } from '../../../src/model/networkIndex.service';
import { Timeline } from '../../../src/model/timeline.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { londonNetwork } from '../../support/fixtures/datasets.utils';

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
});

describe('Timeline on London', () => {
  const { index, timeline } = timelineOf(londonNetwork());
  const stepsOn = (date: string) => timeline.steps.filter(step => step.time === toTimestamp(date));

  test('reaches Rickmansworth on the Metropolitan in 1887, not with the 1925 Watford branch', () => {
    const reached = stepsOn('1887-09-01').find(step => step.kind === 'open' && step.line === 'metropolitan');
    const stations = reached?.kind === 'open' ? reached.segments.flatMap(segment => [segment.stationA, segment.stationB]) : [];
    expect(stations).toContain('rickmansworth');
  });

  test('plays the Victoria line in its three 1968–69 stages', () => {
    for (const date of ['1968-09-01', '1968-12-01', '1969-03-07'])
      expect(stepsOn(date).some(step => step.kind === 'open' && step.line === 'victoria')).toBe(true);
  });

  test('turns the Stanmore branch from Bakerloo to Jubilee before the 1979 tunnel opens', () => {
    const steps = stepsOn('1979-05-01');
    expect(steps[0]?.kind).toBe('identity');
    expect(steps.some(step => step.kind === 'open' && step.line === 'jubilee')).toBe(true);
  });

  test('splits the Overground once, in 2024, for all six lines', () => {
    const steps = stepsOn('2024-11-20');
    expect(steps).toHaveLength(1);
    const [split] = steps;
    if (split?.kind !== 'identity') throw new Error('expected an identity step');
    expect(split.lines).toHaveLength(6);
  });

  test('draws the 1863 Metropolitan as one line, not three side by side', () => {
    const first = timeline.steps[0];
    if (first?.kind !== 'open') throw new Error('expected the first step to open a line');
    expect(first.line).toBe('metropolitan');
    expect(new Set(first.lineSegments.map(lineSegment => timeline.identityOf(lineSegment.line, 0).id))).toEqual(new Set(['metropolitan']));
  });

  test('opens the whole Uxbridge branch together in 1904, not part of it in 1863', () => {
    const uxbridge = stepsOn('1904-07-04').find(step => step.kind === 'open' && step.line === 'metropolitan');
    const stations = uxbridge?.kind === 'open' ? new Set(uxbridge.segments.flatMap(segment => [segment.stationA, segment.stationB])) : new Set();
    expect(stations).toContain('eastcote');
    expect(stations).toContain('uxbridge');
  });

  test('ends with every line open but the two that closed for good', () => {
    const open = new Set(index.lineSegments.filter(lineSegment => timeline.isOpen(lineSegment, timeline.steps.length)).map(lineSegment => lineSegment.line));
    const closed = ['east-london', 'northern-city'];
    expect([...open].sort()).toEqual(index.lineIds.filter(line => !closed.includes(line)).sort());
  });

  test('suspends the Aldwych branch through the war', () => {
    const aldwych = index.lineSegments.filter(lineSegment => lineSegment.segment.stationB === 'aldwych' || lineSegment.segment.stationA === 'aldwych');
    expect(aldwych.map(lineSegment => [lineSegment.opens, lineSegment.closes])).toEqual([
      [toTimestamp('1907-11-30'), toTimestamp('1940-09-22')],
      [toTimestamp('1946-07-01'), toTimestamp('1994-10-01')],
    ]);
  });

  test('never stops the District at Canada Water, opened long after it left the East London line', () => {
    expect(timeline.everServes('canada-water', 'district')).toBe(false);
    expect(timeline.everServes('canada-water', 'east-london')).toBe(true);
  });
});
