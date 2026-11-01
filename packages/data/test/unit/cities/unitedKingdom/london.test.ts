import { describe, expect, test } from 'vitest';
import { toTimestamp } from '@railtime/core/date.utils';
import { NetworkEngine } from '@railtime/network/engine.service';
import { NetworkFacts } from '@railtime/network/facts.service';
import type { TrackSegment } from '@railtime/network/engine.types';
import { playbackOf, snapshotOf } from '@railtime/renderer/testing/playback';
import { cityNetwork, lineSplits, playPlan, playWholeHistory } from '../../../support/history.utils';

const london = cityNetwork('london');
const { index, timeline } = new NetworkEngine(london, null, toTimestamp('2026-01-01'));
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
      'metropolitan 1891-07-01: 2 pieces',
      // The City & South London's north end closed for rebuilding while its south ran on.
      'northern 1922-08-08: 2 pieces',
      // The Piccadilly took Ealing–South Harrow; an isolated District service ran on to Uxbridge until 1933.
      'district 1932-07-04: 2 pieces',
      // The bomb at Balham closed Clapham South–Tooting Bec; Morden's end ran on alone until January.
      'northern 1940-10-15: 2 pieces',
      // The Jubilee extension opened from Stratford first, joined to the rest that autumn.
      'jubilee 1999-05-14: 2 pieces',
      // The East London line reopened before it joined the North London; then the West Anglia lines and Romford–Upminster joined, apart.
      'london-overground 2010-04-27: 2 pieces',
      'london-overground 2015-05-31: 3 pieces',
      // TfL Rail took over Paddington–Heathrow, apart from Liverpool Street–Shenfield until the tunnel opened.
      'tfl-rail 2018-05-20: 2 pieces',
    ]);
  });

  test('suspends the District past the future Hounslow East in 1905 without a stop there: it opened only in 1909', () => {
    const suspended = stepsOn('1905-06-13').find(step => step.kind === 'close');
    if (suspended?.kind !== 'close') throw new Error('the District leaves its direct Hounslow line on 13 June 1905');
    expect(timeline.retreatOf(suspended).reach.filter(reached => reached.isNew)).toEqual([]);
  });

  test('opens the Hampstead tube in 1907 a branch at a time: to Golders Green, then from Camden Town to Highgate', () => {
    const opened = stepsOn('1907-06-22').filter(step => step.kind === 'open');
    const ends = opened.map(step => (step.kind === 'open' ? new Set(step.segments.flatMap(segment => [segment.stationA, segment.stationB])) : new Set()));
    expect(ends.map(stations => ['golders-green', 'archway'].filter(station => stations.has(station)))).toEqual([['golders-green'], ['archway']]);
  });

  test('closes the East London line in 2007 a branch at a time: New Cross Gate back to Surrey Quays, then the rest', () => {
    const closed = stepsOn('2007-12-23').filter(step => step.kind === 'close');
    const reaches = closed.map(step =>
      step.kind === 'close' ? step.lineSegments.some(({ segment }) => segment.stationB === 'new-cross-gate' || segment.stationA === 'new-cross-gate') : null,
    );
    expect(reaches).toEqual([true, false]);
  });

  test('extends the Central line in 1920 out of its Wood Lane loop to Ealing Broadway, named from Wood Lane', () => {
    const facts = NetworkFacts.create(london, { today: toTimestamp('2026-01-01') });
    const extended = stepsOn('1920-08-03').find(step => step.kind === 'open' && step.line === 'central');
    if (extended?.kind !== 'open') throw new Error('the Central line reaches Ealing Broadway on 3 August 1920');
    expect(timeline.growthOf(extended).reach[0]?.station).toBe('white-city');
    expect(facts.change(extended.index).subtitle).toBe('Wood Lane – Ealing Broadway');
  });

  test('closes City Road in 1922 on its running line, then suspends the City & South London under it', () => {
    const day = stepsOn('1922-08-08');
    const closing = day.find(step => step.kind === 'stationClose' && step.station === 'city-road');
    const suspended = day.find(step => step.kind === 'close' && step.line === 'northern');
    if (!closing || !suspended) throw new Error('City Road closes as the Northern line is suspended on 8 August 1922');
    expect(closing.index).toBeLessThan(suspended.index);
    // As it closes, its line still runs through it: there is a station to fade.
    const track = index.lineSegmentsAt('city-road').filter(lineSegment => lineSegment.line === 'northern');
    expect(track.some(lineSegment => timeline.isOpen(lineSegment, closing.index))).toBe(true);
    expect(timeline.servesStation('city-road', 'northern', closing.index)).toBe(true);
  });

  test('runs fast lines beside the stopping ones they pass, on the same track, never on track of their own over it', () => {
    const passing = [
      ['metropolitan', ['west-hampstead', 'kilburn', 'willesden-green', 'dollis-hill', 'neasden']],
      ['piccadilly', ['west-kensington', 'ravenscourt-park', 'stamford-brook', 'chiswick-park']],
    ] as const;
    for (const [line, stations] of passing)
      for (const station of stations) {
        expect(index.lineSegmentsAt(station).some(lineSegment => lineSegment.line === line)).toBe(true);
        expect(timeline.everServes(station, line)).toBe(false);
      }
  });

  test('renames no station while no line runs there: Windsor, left by the District in 1885', () => {
    expect(timeline.steps.some(step => step.kind === 'rename' && step.station === 'windsor-and-eton-central')).toBe(false);
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

  test('opens the DLR in 1987 and extends it to Bank, Beckton, Lewisham, Woolwich Arsenal and Stratford International', () => {
    for (const date of ['1987-08-31', '1991-07-29', '1994-03-28', '1995-07-31', '1999-11-20', '2005-12-02', '2009-01-10', '2011-08-31'])
      expect(stepsOn(date).some(step => step.kind === 'open' && step.line === 'dlr')).toBe(true);
    // Canary Wharf, Pudding Mill Lane, Canning Town, Cutty Sark and Langdon Park opened on track the DLR already ran.
    expect(timeline.everServes('canary-wharf-3', 'dlr')).toBe(true);
    expect(stepsOn('2007-12-09').some(step => step.kind === 'infill' && step.station === 'langdon-park')).toBe(true);
    // Its stations shared with the Underground, the Overground and the Elizabeth line are one station each.
    for (const station of ['bank', 'shadwell', 'stratford', 'west-ham', 'canning-town', 'custom-house'])
      expect(index.lineSegmentsAt(station).some(lineSegment => lineSegment.line === 'dlr')).toBe(true);
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
    const snapshot = snapshotOf(playbackOf(london));
    expect(snapshot.stats.stations).toBe(423);
    expect(snapshot.stats.lines).toBe(19);
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
