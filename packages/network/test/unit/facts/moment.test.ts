import { toTimestamp } from '@railtime/core/date.utils';
import { required } from '@railtime/core/required.utils';
import { lineId, networkId, planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { engineOf } from '../../../src/engine/engine.utils';
import { statsDrawn } from '../../../src/engine/history.utils';
import { NetworkFacts } from '../../../src/facts/facts.service';
import { loopNetwork } from '../../support/factories/loopNetwork.utils';
import { routeNetwork } from '../../support/factories/routeNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf as plainFactsOf, questionsOn } from '../../support/facts.utils';

/**
 * The tiny network's facts, and its questions answered on a date.
 *
 * @param date - The date shown.
 * @returns The questions on the date, and the facts.
 */
const queriesOn = (date: string) => {
  const facts = plainFactsOf(tinyNetwork());
  return { queries: questionsOn(facts, toTimestamp(date)), facts };
};

describe('FactsAt', () => {
  test('counts the network as far as a change is drawn, the one count for a playhead', () => {
    const { facts } = queriesOn('1935-01-01');
    const { playheads } = facts;
    const done = facts.asOf(playheads.after(1)).stats();
    const after = facts.asOf(playheads.after(2)).stats();
    expect(after.stations).toBeGreaterThan(done.stations);
    expect(facts.asOf(playheads.after(1, 0.5)).stats()).toEqual(statsDrawn(done, after, 0.5));
    expect(facts.asOf(playheads.after(1, 0.01)).stats().stations).toBeGreaterThan(done.stations);
    expect(facts.asOf(playheads.after(1, 0)).stats()).toEqual(done);
  });

  test('counts a closure down from the moment it reaches the line', () => {
    const { facts } = queriesOn('1935-01-01');
    const { playheads } = facts;
    const sizeAt = (cursor: number, progress = 0) => facts.asOf(playheads.after(cursor, progress)).stats();
    const closure = required(
      facts.changes().find(change => sizeAt(change.index + 1).lines < sizeAt(change.index).lines),
      'a change that closes a line',
    );
    expect(closure.kind).toBe('close');
    expect(sizeAt(closure.index, 0.01).lines).toBe(sizeAt(closure.index + 1).lines);
  });

  test('lists every line, with its network, colour and opening as a line of its own', () => {
    const { facts } = queriesOn('1935-01-01');
    expect(facts.lines()).toEqual([
      { id: 'red', name: 'Red', network: 'metro', networkName: 'Metro', color: { light: '#ff0000', dark: '#ff0000' }, opened: toTimestamp('1900-01-01') },
      { id: 'blue', name: 'Blue', network: 'metro', networkName: 'Metro', color: { light: '#0000ff', dark: '#0000ff' }, opened: toTimestamp('1930-01-01') },
      { id: 'pink', name: 'Pink', network: 'metro', networkName: 'Metro', color: { light: '#ff88cc', dark: '#ff88cc' }, opened: toTimestamp('1990-01-01') },
      { id: 'green', name: 'Green', network: 'metro', networkName: 'Metro', color: { light: '#00aa00', dark: '#00aa00' }, opened: toTimestamp('1970-01-01') },
    ]);
  });

  test('says which lines had opened as themselves by the moment, each on the day it did', () => {
    const facts = plainFactsOf(tinyNetwork());
    const openedOn = (date: string) => [...questionsOn(facts, toTimestamp(date)).linesOpened()];
    expect(openedOn('1899-06-01')).toEqual([]);
    expect(openedOn('1935-01-01')).toEqual(['red', 'blue']);
    // Drawn as red until then, pink is not a line of its own until the day it parts.
    expect(openedOn('1989-12-31')).toEqual(['red', 'blue', 'green']);
    expect(openedOn('1990-01-01')).toEqual(['red', 'blue', 'pink', 'green']);
  });

  test('runs the trains of the moment: the lines open then, and none before', () => {
    const facts = plainFactsOf(tinyNetwork());
    const linesThen = (date: string) =>
      new Set(
        questionsOn(facts, toTimestamp(date))
          .trains()
          .timetables.map(({ run }) => run.line),
      );
    expect(linesThen('1899-06-01').size).toBe(0);
    expect([...linesThen('1935-01-01')]).toContain('blue');
    expect([...linesThen('1955-01-01')]).not.toContain('blue');
  });

  test('has every line open in a plan, one only the plan builds among them', () => {
    const network = tinyNetwork();
    const plan = required(network.plans?.[planId('extension')], 'the plan');
    network.lines[lineId('new')] = { name: 'New', network: networkId('metro'), mode: 'metro', color: '#123456' };
    plan.sections.push({ line: lineId('new'), stations: [stationId('a'), stationId('b')] });
    const facts = plainFactsOf(network, planId('extension'));
    expect([...facts.asOf(facts.playheads.today()).linesOpened()]).not.toContain('new');
    expect([...facts.asOf(facts.playheads.end()).linesOpened()]).toContain('new');
  });

  test("gives a line's stops in order under the names of the date, its length and the changes that made it", () => {
    const { queries, facts } = queriesOn('1915-01-01');
    const red = queries.line(lineId('red'));
    expect(red.branches).toEqual([
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'd', name: 'Old D' },
      ],
    ]);
    expect(red).toMatchObject({ stations: 3, color: { light: '#ff0000', dark: '#ff0000' } });
    expect(red.km).toBeCloseTo(3, 1);
    expect(red.changes.map(change => engineOf(facts).timeline.steps[change]?.kind)).toContain('open');
    expect(() => queries.line(lineId('purple'))).toThrow('Missing line purple');
  });

  test("tells a station's lines with their dates, its names then, and where it changes to", () => {
    const { queries } = queriesOn('1935-01-01');
    // Green reaches D only after D closed: it passes D by, and is not one of its lines.
    expect(queries.station(stationId('d'))).toEqual({
      id: 'd',
      name: 'D',
      otherNames: ['Д'],
      lines: [{ id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: '1910-01-01', closed: '1960-01-01', calls: true }],
      formerNames: [{ name: 'Old D', otherNames: ['Старий Д'], until: '1925-01-01' }],
      // Pink is still drawn as red at A: one line.
      transfers: [{ id: 'a', name: 'A', lines: [{ id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' } }] }],
    });
    // Before it was renamed: its old name, no former ones.
    const early = queriesOn('1915-01-01');
    expect(early.queries.station(stationId('d'))).toMatchObject({ name: 'Old D', formerNames: [] });
    // A line whose track there closed has closed there; an infill station opened on a line on its own date.
    const later = queriesOn('1955-01-01');
    expect(later.queries.station(stationId('c')).lines).toEqual([
      { id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: '1920-06-01', calls: true },
      { id: 'green', name: 'Green line', color: { light: '#00aa00', dark: '#00aa00' }, opened: '1970-01-01', calls: false },
    ]);
  });

  test('makes no transfer to a station no line calls at yet', () => {
    const { queries } = queriesOn('1905-01-01');
    expect(queries.station(stationId('a')).transfers).toEqual([]);
  });

  test('lists the stations a line calls at for a search, by name, with their colours', () => {
    const { queries } = queriesOn('1935-01-01');
    expect(queries.stations().map(station => [station.id, station.name, station.colors])).toEqual([
      // Pink is drawn as red: one colour.
      ['a', 'A', [{ light: '#ff0000', dark: '#ff0000' }]],
      [
        'b',
        'B',
        [
          { light: '#ff0000', dark: '#ff0000' },
          { light: '#0000ff', dark: '#0000ff' },
        ],
      ],
      // Blue runs through C but never called there.
      ['c', 'C', [{ light: '#ff0000', dark: '#ff0000' }]],
      ['d', 'D', [{ light: '#ff0000', dark: '#ff0000' }]],
    ]);
    expect(queries.stations().find(station => station.id === 'd')?.otherNames).toEqual(['Д']);
    // In 1915 the line passes C by: not one to look for.
    const early = queriesOn('1915-01-01');
    expect(early.queries.stations().map(station => station.id)).toEqual(['a', 'b', 'd']);
  });

  test("finds a route with the stops' names of the date, and none where nothing runs", () => {
    const { queries } = queriesOn('1935-01-01');
    const [route] = queries.routes(stationId('a'), stationId('d'));
    expect(route).toMatchObject({ from: { id: 'a', name: 'A' }, to: { id: 'd', name: 'D' }, changes: 0 });
    expect(route?.legs).toEqual([expect.objectContaining({ kind: 'ride', line: 'red', lineName: 'Red line', color: { light: '#ff0000', dark: '#ff0000' } })]);
    expect(route?.segments).toEqual([[0, 1, 2]]);
    expect(route?.best).toEqual(['fastest']);
    const before = queriesOn('1899-06-01');
    expect(before.queries.routes(stationId('a'), stationId('d'))).toEqual([]);
  });

  test('offers the ways between two stations fastest first, each with what it is best at', () => {
    const facts = NetworkFacts.create(routeNetwork(), { today: toTimestamp('2026-01-01') });
    const routes = facts.asOf(facts.playheads.today()).routes(stationId('a'), stationId('e'));
    expect(routes.map(route => route.legs.map(leg => (leg.kind === 'ride' ? leg.line : 'walk')))).toEqual([
      ['red', 'blue'],
      ['red', 'walk', 'green'],
      ['yellow'],
    ]);
    expect(routes.map(route => route.best)).toEqual([['fastest'], [], ['fewest-changes']]);
  });

  test('times every station from one, soonest first, each in its band; nothing from a station no line calls at', () => {
    const { queries } = queriesOn('1935-01-01');
    const reach = queries.reach(stationId('a'));
    expect(reach?.from).toEqual({ id: 'a', name: 'A' });
    expect(reach?.stations.map(station => station.id)).toEqual(['b', 'c', 'd']);
    expect(reach?.stations.every(station => station.band === 0)).toBe(true);
    const before = queriesOn('1899-06-01');
    expect(before.queries.reach(stationId('a'))).toBeNull();
  });

  test('colours the track a reach gets along, each segment once in its band, only track open at the moment', () => {
    expect(queriesOn('1935-01-01').queries.reach(stationId('a'))?.track).toEqual([0, 1, 2].map(segment => ({ segment, band: 0 })));
    // Only A–B is open in 1905.
    expect(queriesOn('1905-01-01').queries.reach(stationId('a'))?.track).toEqual([{ segment: 0, band: 0 }]);
  });

  test('tells how the network grew, worked out once, and its records on the date', () => {
    const { queries, facts } = queriesOn('1935-01-01');
    const growth = facts.growth();
    expect(facts.growth().years).toBe(growth.years);
    expect(growth.years.slice(0, 2)).toEqual([
      { year: 1899, stations: 0, km: 0, lines: 0 },
      { year: 1900, stations: 2, km: expect.closeTo(1, 1), lines: 1 },
    ]);
    expect(growth.decades.slice(0, 3)).toEqual([
      { decade: 1900, stations: 2 },
      { decade: 1910, stations: 1 },
      { decade: 1920, stations: 1 },
    ]);
    const records = queries.records(2);
    expect(records.oldest.map(station => station.id)).toEqual(['a', 'b']);
    expect(records.busiest[0]).toMatchObject({ id: 'b', lines: [{ id: 'red' }, { id: 'blue' }] });
    expect(records.longest.map(line => line.id)).toEqual(['red', 'blue']);
  });

  test('says a line does not call at a station through a spell closed, and does again after', () => {
    const network = tinyNetwork();
    // Pink, drawn as red, closes with it: on the map, red calls there while either does.
    const spell = [{ from: '1915-03-15', until: '1926-07-19' }];
    network.stations[stationId('b')] = { ...network.stations[stationId('b')]!, suspended: { [lineId('red')]: spell, [lineId('pink')]: spell } };
    const callsAt = (date: string) =>
      questionsOn(plainFactsOf(network), toTimestamp(date))
        .station(stationId('b'))
        .lines.find(line => line.id === 'red')?.calls;
    expect(['1915-01-01', '1920-01-01', '1930-01-01'].map(callsAt)).toEqual([true, false, true]);
  });

  test('dates a line closed at a station when all its track there has, before 1970 too', () => {
    // Blue left B – C in 1950, after a spell away in the 1940s.
    const { queries } = queriesOn('1955-01-01');
    expect(queries.station(stationId('b')).lines).toEqual([
      { id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: '1900-01-01', calls: true },
      { id: 'blue', name: 'Blue line', color: { light: '#0000ff', dark: '#0000ff' }, opened: '1930-01-01', closed: '1950-01-01', calls: false },
    ]);
  });

  test("lists a plan's undated line at a station of its own, and a former name from the day it was dropped", () => {
    const queries = questionsOn(plainFactsOf(tinyNetwork(), planId('extension')), 'end');
    expect(queries.station(stationId('e')).lines).toEqual([
      { id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: null, calls: true },
    ]);
    const renamed = queriesOn('1925-01-01');
    expect(renamed.queries.station(stationId('d')).formerNames.map(former => former.name)).toEqual(['Old D']);
  });

  test("keeps a line's changes to its own", () => {
    const { queries, facts } = queriesOn('1935-01-01');
    const blueOpens = engineOf(facts).timeline.steps.find(step => step.kind === 'open' && step.line === 'blue')!.index;
    expect(queries.line(lineId('red')).changes).not.toContain(blueOpens);
    expect(queries.line(lineId('blue')).changes).toContain(blueOpens);
  });

  test('ranks the records: oldest by year then name, busiest by lines, longest by km, lines with no track left out', () => {
    const { queries } = queriesOn('1935-01-01');
    const records = queries.records(10);
    expect(records.oldest.map(station => [station.id, station.year])).toEqual([
      ['a', 1900],
      ['b', 1900],
      ['d', 1910],
      ['c', 1920],
    ]);
    expect(records.busiest.map(station => station.id)).toEqual(['b', 'a', 'c', 'd']);
    // Green has no track yet, and pink is drawn as red: neither is a line to rank.
    expect(records.longest.map(line => line.id)).toEqual(['red', 'blue']);
  });

  describe('says what the map draws at the moment', () => {
    /** The small network with pink, drawn as red until 1990, running on from B to C, where red does not. */
    const partedNetwork = () => {
      const network = tinyNetwork();
      network.segments[1]!.lines = { [lineId('pink')]: { open: '1910-01-01' } };
      network.stations[stationId('c')] = { ...network.stations[stationId('c')]!, infill: { [lineId('pink')]: '1911-01-01' } };
      return network;
    };
    const asked = (year: string) => questionsOn(plainFactsOf(partedNetwork()), toTimestamp(year));

    test("lists a station's lines as drawn: a line drawn as another is that line, dated from the first of them", () => {
      expect(asked('1935-01-01').station(stationId('b')).lines).toEqual([
        { id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: '1900-01-01', calls: true },
      ]);
      expect(
        asked('1995-01-01')
          .station(stationId('b'))
          .lines.map(line => line.id),
      ).toEqual(['red', 'pink']);
    });

    test('gives a line as drawn: asked for one drawn as it, the whole of what the map shows', () => {
      const then = asked('1935-01-01');
      expect(then.line(lineId('pink'))).toEqual(then.line(lineId('red')));
      expect(then.line(lineId('pink'))).toMatchObject({ id: 'red', name: 'Red', stations: 4, branches: [expect.any(Array)] });
      expect(then.line(lineId('pink')).km).toBeCloseTo(3, 1);
      const later = asked('1995-01-01');
      expect(later.line(lineId('pink'))).toMatchObject({ id: 'pink', stations: 3 });
    });

    test('takes in the changes of every line it draws', () => {
      const facts = plainFactsOf(partedNetwork());
      const then = questionsOn(facts, toTimestamp('1935-01-01')).line(lineId('red'));
      const kinds = then.changes.flatMap(change => {
        const step = engineOf(facts).timeline.steps[change];
        return step?.kind === 'identity' ? [step.text] : [];
      });
      expect(kinds).toEqual(['Pink becomes its own line']);
    });

    test('gives the stops either side on a line as drawn', () => {
      const then = asked('1935-01-01').directions(stationId('b'));
      expect([...then.keys()]).toEqual(['red']);
      expect(then.get(lineId('red'))).toEqual([{ previous: { id: 'a', name: 'A', towards: null }, next: { id: 'c', name: 'C', towards: 'D' } }]);
    });

    test('names a route as drawn', () => {
      expect(asked('1935-01-01').routes(stationId('a'), stationId('c'))[0]?.legs).toMatchObject([{ line: 'red', lineName: 'Red line' }]);
      expect(asked('1995-01-01').routes(stationId('a'), stationId('c'))[0]?.legs).toMatchObject([{ line: 'pink', lineName: 'Pink line' }]);
    });

    test('ranks a line as drawn, its track once', () => {
      const [red, ...others] = asked('1935-01-01').records(5).longest;
      expect(red?.id).toBe('red');
      expect(red?.km).toBeCloseTo(3, 1);
      expect(others.map(line => line.id)).toEqual([]);
    });

    test('asks a line that only others are drawn as like any other', () => {
      const network = tinyNetwork();
      network.lines[lineId('shared')] = {
        name: 'Shared',
        fullName: 'Shared track',
        network: network.lines[lineId('red')]!.network,
        mode: 'metro',
        color: '#123456',
        pseudo: true,
      };
      network.lines[lineId('blue')] = { ...network.lines[lineId('blue')]!, aliases: [{ until: '1948-01-01', as: lineId('shared'), text: 'Blue on its own' }] };
      const then = questionsOn(plainFactsOf(network), toTimestamp('1935-01-01'));
      expect(then.line(lineId('shared'))).toMatchObject({ id: 'shared', opened: toTimestamp('1930-01-01'), km: expect.closeTo(1, 1) });
      expect(then.station(stationId('b')).lines.map(line => [line.id, line.name])).toEqual([
        ['red', 'Red line'],
        ['shared', 'Shared track'],
      ]);
    });
  });

  test('gives a one-way line only the stop its trains go on to, and both on a line that runs both ways', () => {
    const today = plainFactsOf(loopNetwork()).today();
    const stops = today.directions(stationId('a'));
    expect(stops.get(lineId('clockwise'))).toMatchObject([{ previous: null, next: { id: 'c' } }]);
    expect(stops.get(lineId('anticlockwise'))).toMatchObject([{ previous: null, next: { id: 'b' } }]);
    const round = today.line(lineId('clockwise')).branches[0]?.map(stop => stop.id);
    expect(round?.slice(0, 3)).toEqual(['a', 'c', 'b']);
  });

  test('lists stations for a search by their names, not their ids', () => {
    const network = tinyNetwork();
    network.stations[stationId('a')]!.name = 'Zed';
    const queries = questionsOn(plainFactsOf(network), toTimestamp('1935-01-01'));
    expect(queries.stations().map(station => station.name)).toEqual(['B', 'C', 'D', 'Zed']);
  });
});
