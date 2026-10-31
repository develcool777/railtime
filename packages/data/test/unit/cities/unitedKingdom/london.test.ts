import { describe, expect, test } from 'vitest';
import { buildNetworkSnapshot } from '../../../../../renderer/src/layers/snapshot.utils';
import { toTimestamp } from '@railtime/network/date.utils';
import { NetworkIndex } from '@railtime/network/engine/index.service';
import type { TrackSegment } from '@railtime/network/engine/index.types';
import { Timeline } from '@railtime/network/engine/timeline.service';
import { playbackOf, renderStateOf } from '../../../../../renderer/test/support/playback.utils';
import { cityNetwork, lineSplits, playPlan, playWholeHistory } from '../../../support/history.utils';

const london = cityNetwork('london');
const index = new NetworkIndex(london);
const timeline = new Timeline(index);
const stepsOn = (date: string) => timeline.steps.filter(step => step.time === toTimestamp(date));
const startOf = (segment: TrackSegment) => (segment.travel === 1 ? segment.stationA : segment.stationB);
const endOf = (segment: TrackSegment) => (segment.travel === 1 ? segment.stationB : segment.stationA);

describe('London', () => {
  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('london'))).toEqual([
      // Metropolitan and District trains onto the East London from 1 October 1884, the link through Aldgate East from the 6th.
      'metropolitan 1884-10-01: 2 pieces',
      'district 1884-10-01: 2 pieces',
      // The Metropolitan took over the Aylesbury & Buckingham a year before its own line reached Aylesbury.
      'metropolitan 1891-07-01: 3 pieces',
      // The City & South London's north end closed for rebuilding while its south ran on.
      'northern 1922-08-08: 2 pieces',
      // The Piccadilly took Ealing–South Harrow; an isolated District service ran on to Uxbridge until 1933.
      'district 1932-07-04: 2 pieces',
      // The Jubilee extension opened from Stratford first, joined to the rest that autumn.
      'jubilee 1999-05-14: 2 pieces',
      // The East London line reopened before it joined the North London; then the West Anglia lines and Romford–Upminster joined, apart.
      'london-overground 2010-04-27: 2 pieces',
      'london-overground 2015-05-31: 3 pieces',
      // TfL Rail took over Paddington–Heathrow, apart from Liverpool Street–Shenfield until the tunnel opened.
      'tfl-rail 2018-05-20: 2 pieces',
    ]);
  });

  test('reaches Rickmansworth on the Metropolitan in 1887, not with the 1925 Watford branch', () => {
    const reached = stepsOn('1887-09-01').find(step => step.kind === 'open' && step.line === 'metropolitan');
    const stations = reached?.kind === 'open' ? reached.segments.flatMap(segment => [segment.stationA, segment.stationB]) : [];
    expect(stations).toContain('rickmansworth');
  });

  test('extends the Metropolitan to Harrow in 1880 by Neasden, its non-stop track to Wembley Park only from 1939', () => {
    const extended = stepsOn('1880-08-02').filter(step => step.kind === 'open');
    expect(extended).toHaveLength(1);
    const stations = extended[0]?.kind === 'open' ? extended[0].segments.flatMap(segment => [segment.stationA, segment.stationB]) : [];
    expect(stations).toEqual(expect.arrayContaining(['willesden-green', 'neasden', 'harrow-on-the-hill']));
    expect(stations).not.toContain('finchley-road');
    expect(stepsOn('1939-11-20').some(step => step.kind === 'open' && step.line === 'metropolitan')).toBe(true);
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

  test('runs through every plain station: one segment ends where the next starts', () => {
    const segmentsAt = new Map<string, TrackSegment[]>();
    for (const segment of index.segments)
      for (const station of [segment.stationA, segment.stationB]) segmentsAt.set(station, [...(segmentsAt.get(station) ?? []), segment]);
    const plain = [...segmentsAt.entries()].filter(([, segments]) => segments.length === 2);
    const broken = plain.filter(([station, [first, second]]) => {
      const continues = (from?: TrackSegment, to?: TrackSegment) =>
        from !== undefined && to !== undefined && endOf(from) === station && startOf(to) === station;
      return !continues(first, second) && !continues(second, first);
    });
    expect(plain.length).toBeGreaterThan(200);
    expect(broken.map(([station]) => station)).toEqual([]);
  });

  test('keeps the Circle and District on the same sides from Gloucester Road through South Kensington', () => {
    const between = (from: string, to: string) => {
      const found = index.segments.find(segment => [segment.stationA, segment.stationB].includes(from) && [segment.stationA, segment.stationB].includes(to));
      if (!found) throw new Error(`no segment ${from} – ${to}`);
      return found;
    };
    expect(endOf(between('gloucester-road', 'south-kensington'))).toBe(startOf(between('south-kensington', 'sloane-square')));
  });

  test('is at its known size today', () => {
    const snapshot = buildNetworkSnapshot(renderStateOf(playbackOf(london)), false);
    expect(snapshot.stats.stations).toBe(384);
    expect(snapshot.stats.lines).toBe(18);
  });

  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(london);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.mostHighlighted).toBeGreaterThan(5);
    // About 24 minutes at 1×: the bound catches a history that never ends.
    expect(played.seconds).toBeLessThan(60 * 60);
  });

  test.each(['under-construction', 'surrey-canal', 'bakerloo-extension', 'crossrail-2', 'dlr-thamesmead', 'west-london-orbital', 'croxley-rail-link'])(
    'plays on through its %s plan, section by section',
    plan => {
      const played = playPlan(london, plan);
      expect(played.steps).toBeGreaterThan(0);
      expect(played.started).toBe(played.steps);
      expect(played.cursor).toBe(played.steps);
    },
  );
});
