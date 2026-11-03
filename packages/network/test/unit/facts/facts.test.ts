import { describe, expect, test } from 'vitest';
import { toTimestamp } from '@railtime/core/date.utils';
import { NetworkFacts } from '../../../src/facts/facts.service';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';
import { hiddenNetwork } from '../../support/factories/hiddenNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { routeNetwork } from '../../support/factories/routeNetwork.utils';
import { factsOf as plainFactsOf, questionsOn } from '../../support/facts.utils';
import { bandOf, networkSummary, planFacts, reachedSegments } from '../../../src/facts/facts.utils';
import { REACH_BANDS } from '../../../src/facts/facts.constants';

/** Today, for every network here. */
const TODAY = toTimestamp('2026-01-01');

/**
 * The tiny network's facts, `red` given a colour of its own for the dark theme.
 *
 * @param plan - A plan to build on it.
 * @returns Its facts.
 */
const factsOf = (plan?: string) => {
  const network = tinyNetwork();
  network.lines.red = { ...network.lines.red!, darkColor: '#ff6666' };
  return NetworkFacts.create(network, { ...(plan ? { plan } : {}), today: TODAY });
};

describe('NetworkFacts', () => {
  test('hides the lines of its networks hidden at first unless asked otherwise, and lists them either way', () => {
    const network = hiddenNetwork();
    const plain = NetworkFacts.create(network, { today: TODAY });
    expect(plain.hidden).toEqual(['grey']);
    expect(plain.lines().map(line => line.id)).not.toContain('grey');
    expect(plain.find('station', 'x')).toBeNull();
    expect(plain.networkChoices().map(entry => entry.id)).toEqual(['metro', 'rail']);
    const withRail = NetworkFacts.create(network, { today: TODAY, hidden: ['blue', 'nowhere'] });
    expect(withRail.hidden).toEqual(['blue']);
    expect(withRail.lines().map(line => line.id)).toEqual(expect.arrayContaining(['grey']));
    expect(withRail.lines().map(line => line.id)).not.toContain('blue');
    expect(withRail.find('station', 'x')).toEqual({ id: 'x', name: 'X' });
  });

  test('takes a line out for the years it was drawn as a line hidden, going as what it was, back as itself', () => {
    const network = tinyNetwork();
    // Green, on C – D from 1970, drawn as red until 1975, then as blue until 1990.
    network.lines.green = {
      ...network.lines.green!,
      aliases: [
        { until: '1975-01-01', as: 'red', text: 'Green runs as Blue' },
        { until: '1990-01-01', as: 'blue', text: 'Green becomes its own line' },
      ],
    };
    const facts = NetworkFacts.create(network, { today: TODAY, hidden: ['blue'] });
    const titlesIn = (year: number) =>
      facts
        .changes()
        .filter(change => change.time !== null && new Date(change.time).getUTCFullYear() === year)
        .map(change => change.title);
    expect(titlesIn(1975)).toEqual(['Red line: section closes']);
    expect(titlesIn(1990)).toEqual(['Pink becomes its own line', 'Green line opens']);
    expect(facts.lines().find(line => line.id === 'green')?.opened).toBe(toTimestamp('1990-01-01'));
  });

  test('shows the network as built when its plan builds only on lines hidden', () => {
    const facts = NetworkFacts.create(hiddenNetwork(), { today: TODAY, plan: 'grey-on' });
    expect(facts.plan).toBeNull();
    expect(NetworkFacts.create(hiddenNetwork(), { today: TODAY, plan: 'grey-on', hidden: [] }).plan).toBe('grey-on');
  });

  test('runs from its first date to today, or to its last dated change after it', () => {
    expect(factsOf().range).toEqual({ start: toTimestamp('1899-01-01'), end: TODAY, today: TODAY });
  });

  test('colours a line in both themes: its dark colour, if it has one, else its own', () => {
    const facts = factsOf();
    expect(facts.colorOf('red')).toEqual({ light: '#ff0000', dark: '#ff6666' });
    expect(facts.colorOf('blue')).toEqual({ light: '#0000ff', dark: '#0000ff' });
    expect(facts.lines().find(line => line.id === 'red')?.color).toEqual({ light: '#ff0000', dark: '#ff6666' });
    expect(facts.change(0).color).toEqual({ light: '#ff0000', dark: '#ff6666' });
  });

  test('opens a city on the plan asked for, if it has it; a network never built on its first', () => {
    expect(NetworkFacts.planToOpen(planOnlyNetwork(), 'second')).toBe('second');
    expect(NetworkFacts.planToOpen(planOnlyNetwork(), 'nowhere')).toBe('first');
    expect(NetworkFacts.planToOpen(planOnlyNetwork(), undefined)).toBe('first');
    expect(NetworkFacts.planToOpen(tinyNetwork(), undefined)).toBeUndefined();
    expect(NetworkFacts.planToOpen(tinyNetwork(), 'extension')).toBe('extension');
  });

  test("sketches the track open today, a segment by its first line, in both themes' colours", () => {
    expect(factsOf().sketch()).toEqual([{ line: 'red', color: { light: '#ff0000', dark: '#ff6666' }, paths: expect.any(Array), dashed: false }]);
    expect(factsOf().sketch()[0]?.paths).toHaveLength(3);
  });

  test('sketches a network never built by its first plan, dashed', () => {
    const [red, ...others] = NetworkFacts.create(planOnlyNetwork(), { today: TODAY }).sketch();
    expect(others).toEqual([]);
    expect(red).toMatchObject({ line: 'red', dashed: true });
    expect(red?.paths).toHaveLength(2);
  });

  test('answers for the moment it is asked about, and for no other', () => {
    const facts = factsOf();
    const early = facts.asOf(facts.playheads.on(toTimestamp('1905-01-01')));
    const later = facts.asOf(facts.playheads.on(toTimestamp('1935-01-01')));
    expect(
      early
        .stations()
        .map(station => station.id)
        .sort(),
    ).toEqual(['a', 'b']);
    expect(later.stations().map(station => station.id)).toContain('d');
    expect(early.station('b').lines.find(line => line.id === 'blue')?.opened).toBe('1930-01-01');
    expect(early.routes('a', 'd')).toEqual([]);
    expect(later.routes('a', 'd')).not.toEqual([]);
  });

  test('answers for today: every dated change on it or before played', () => {
    const facts = factsOf();
    expect(facts.today().stats()).toEqual(facts.asOf(facts.playheads.on(toTimestamp('2026-01-01'))).stats());
  });

  test("names a station as it was called at the moment's date", () => {
    const facts = factsOf();
    expect(facts.asOf(facts.playheads.on(toTimestamp('1915-01-01'))).station('d').name).toBe('Old D');
    expect(facts.asOf(facts.playheads.on(toTimestamp('1935-01-01'))).station('d').name).toBe('D');
  });

  test('finds a line or station by its id, with its name; none it does not have', () => {
    const facts = factsOf();
    expect(facts.find('line', 'red')).toEqual({ id: 'red', name: 'Red' });
    expect(facts.find('station', 'a')).toEqual({ id: 'a', name: 'A' });
    expect(facts.find('station', 'red')).toBeNull();
    expect(facts.find('line', 'nowhere')).toBeNull();
  });

  test('has a history when some year has a station, and none for a network never built', () => {
    expect(factsOf().hasHistory()).toBe(true);
    expect(factsOf().planOnly).toBe(false);
    const planOnly = NetworkFacts.create(planOnlyNetwork(), { plan: 'first', today: TODAY });
    expect(planOnly.hasHistory()).toBe(false);
    expect(planOnly.planOnly).toBe(true);
  });

  test('lists every plan with what it would add, whichever plan is built', () => {
    const plans = factsOf('extension').plans();
    expect(plans).toEqual(factsOf().plans());
    expect(plans.map(plan => plan.id)).toEqual(Object.keys(tinyNetwork().plans ?? {}));
    expect(plans[0]?.facts.stations).toBeGreaterThan(0);
  });

  test('sums the network up as stored, whichever plan is built', () => {
    expect(factsOf('extension').summary()).toEqual(factsOf().summary());
    expect(factsOf().summary()).toMatchObject({ plans: Object.keys(tinyNetwork().plans ?? {}).length, planOnly: false });
  });

  test('gives the stops either side of a station on each of its lines, as at the moment', () => {
    const facts = factsOf();
    expect(
      facts
        .asOf(facts.playheads.on(toTimestamp('1935-01-01')))
        .directions('c')
        .get('red'),
    ).toEqual([{ previous: { id: 'b', name: 'B', towards: 'A' }, next: { id: 'd', name: 'D', towards: null } }]);
  });

  test('builds a plan on the network: its changes play last', () => {
    const plain = factsOf();
    const planned = factsOf('extension');
    expect(planned.plan).toBe('extension');
    expect(planned.changes().length).toBeGreaterThan(plain.changes().length);
    const changes = planned.changes();
    expect(changes.map(change => change.index)).toEqual(planned.engine.timeline.steps.map(step => step.index));
    expect(changes[0]).toMatchObject({ kind: 'open', time: toTimestamp('1900-01-01'), title: 'Red line opens', color: { light: '#ff0000' } });
    expect(changes.slice(-2).map(change => change.time)).toEqual([null, null]);
    // Red runs on from D, where it has stopped calling: the extension is named from C, its last stop.
    expect(changes.at(-2)).toMatchObject({ title: 'Red line extended', subtitle: 'C – E' });
  });
});

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

describe('NetworkFacts questions, at a moment', () => {
  test('lists every line, with its network, colour and opening as a line of its own', () => {
    const { facts } = queriesOn('1935-01-01');
    expect(facts.lines()).toEqual([
      { id: 'red', name: 'Red', network: 'metro', networkName: 'Metro', color: { light: '#ff0000', dark: '#ff0000' }, opened: toTimestamp('1900-01-01') },
      { id: 'blue', name: 'Blue', network: 'metro', networkName: 'Metro', color: { light: '#0000ff', dark: '#0000ff' }, opened: toTimestamp('1930-01-01') },
      { id: 'pink', name: 'Pink', network: 'metro', networkName: 'Metro', color: { light: '#ff88cc', dark: '#ff88cc' }, opened: toTimestamp('1990-01-01') },
      { id: 'green', name: 'Green', network: 'metro', networkName: 'Metro', color: { light: '#00aa00', dark: '#00aa00' }, opened: toTimestamp('1970-01-01') },
    ]);
  });

  test("gives a line's stops in order under the names of the date, its length and the changes that made it", () => {
    const { queries, facts } = queriesOn('1915-01-01');
    const red = queries.line('red');
    expect(red.branches).toEqual([
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'd', name: 'Old D' },
      ],
    ]);
    expect(red).toMatchObject({ stations: 3, color: { light: '#ff0000', dark: '#ff0000' } });
    expect(red.km).toBeCloseTo(3, 1);
    expect(red.changes.map(change => facts.engine.timeline.steps[change]?.kind)).toContain('open');
    expect(() => queries.line('purple')).toThrow('Missing line purple');
  });

  test("tells a station's lines with their dates, its names then, and where it changes to", () => {
    const { queries } = queriesOn('1935-01-01');
    // Green reaches D only after D closed: it passes D by, and is not one of its lines.
    expect(queries.station('d')).toEqual({
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
    expect(early.queries.station('d')).toMatchObject({ name: 'Old D', formerNames: [] });
    // A line whose track there closed has closed there; an infill station opened on a line on its own date.
    const later = queriesOn('1955-01-01');
    expect(later.queries.station('c').lines).toEqual([
      { id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: '1920-06-01', calls: true },
      { id: 'green', name: 'Green line', color: { light: '#00aa00', dark: '#00aa00' }, opened: '1970-01-01', calls: false },
    ]);
  });

  test('makes no transfer to a station no line calls at yet', () => {
    const { queries } = queriesOn('1905-01-01');
    expect(queries.station('a').transfers).toEqual([]);
  });

  test('lists the stations a line calls at for a search, by name, with their colours', () => {
    const { queries } = queriesOn('1935-01-01');
    expect(queries.stations().map(station => [station.id, station.name, station.colors])).toEqual([
      [
        'a',
        'A',
        [
          { light: '#ff0000', dark: '#ff0000' },
          { light: '#ff88cc', dark: '#ff88cc' },
        ],
      ],
      [
        'b',
        'B',
        [
          { light: '#ff0000', dark: '#ff0000' },
          { light: '#0000ff', dark: '#0000ff' },
          { light: '#ff88cc', dark: '#ff88cc' },
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
    const [route] = queries.routes('a', 'd');
    expect(route).toMatchObject({ from: { id: 'a', name: 'A' }, to: { id: 'd', name: 'D' }, changes: 0 });
    expect(route?.legs).toEqual([expect.objectContaining({ kind: 'ride', line: 'red', lineName: 'Red line', color: { light: '#ff0000', dark: '#ff0000' } })]);
    expect(route?.segments).toEqual([[0, 1, 2]]);
    expect(route?.best).toEqual(['fastest']);
    const before = queriesOn('1899-06-01');
    expect(before.queries.routes('a', 'd')).toEqual([]);
  });

  test('offers the ways between two stations fastest first, each with what it is best at', () => {
    const facts = NetworkFacts.create(routeNetwork(), { today: toTimestamp('2026-01-01') });
    const routes = facts.asOf(facts.playheads.today()).routes('a', 'e');
    expect(routes.map(route => route.legs.map(leg => (leg.kind === 'ride' ? leg.line : 'walk')))).toEqual([
      ['red', 'blue'],
      ['red', 'walk', 'green'],
      ['yellow'],
    ]);
    expect(routes.map(route => route.best)).toEqual([['fastest'], [], ['fewest-changes']]);
  });

  test('times every station from one, soonest first, each in its band; nothing from a station no line calls at', () => {
    const { queries } = queriesOn('1935-01-01');
    const reach = queries.reach('a');
    expect(reach?.from).toEqual({ id: 'a', name: 'A' });
    expect(reach?.stations.map(station => station.id)).toEqual(['b', 'c', 'd']);
    expect(reach?.stations.every(station => station.band === 0)).toBe(true);
    const before = queriesOn('1899-06-01');
    expect(before.queries.reach('a')).toBeNull();
  });

  test('colours the track a reach gets along, each segment once in its band, only track open at the moment', () => {
    expect(queriesOn('1935-01-01').queries.reach('a')?.track).toEqual([0, 1, 2].map(segment => ({ segment, band: 0 })));
    // Only A–B is open in 1905.
    expect(queriesOn('1905-01-01').queries.reach('a')?.track).toEqual([{ segment: 0, band: 0 }]);
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
    network.stations.b = { ...network.stations.b!, suspended: { red: [{ from: '1915-03-15', until: '1926-07-19' }] } };
    const callsAt = (date: string) =>
      questionsOn(plainFactsOf(network), toTimestamp(date))
        .station('b')
        .lines.find(line => line.id === 'red')?.calls;
    expect(['1915-01-01', '1920-01-01', '1930-01-01'].map(callsAt)).toEqual([true, false, true]);
  });

  test('dates a line closed at a station when all its track there has, before 1970 too', () => {
    // Blue left B – C in 1950, after a spell away in the 1940s.
    const { queries } = queriesOn('1955-01-01');
    expect(queries.station('b').lines).toEqual([
      { id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: '1900-01-01', calls: true },
      { id: 'pink', name: 'Pink line', color: { light: '#ff88cc', dark: '#ff88cc' }, opened: '1900-01-01', calls: true },
      { id: 'blue', name: 'Blue line', color: { light: '#0000ff', dark: '#0000ff' }, opened: '1930-01-01', closed: '1950-01-01', calls: false },
    ]);
  });

  test("lists a plan's undated line at a station of its own, and a former name from the day it was dropped", () => {
    const queries = questionsOn(plainFactsOf(tinyNetwork(), 'extension'), 'end');
    expect(queries.station('e').lines).toEqual([{ id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: null, calls: true }]);
    const renamed = queriesOn('1925-01-01');
    expect(renamed.queries.station('d').formerNames.map(former => former.name)).toEqual(['Old D']);
  });

  test("keeps a line's changes to its own", () => {
    const { queries, facts } = queriesOn('1935-01-01');
    const blueOpens = facts.engine.timeline.steps.find(step => step.kind === 'open' && step.line === 'blue')!.index;
    expect(queries.line('red').changes).not.toContain(blueOpens);
    expect(queries.line('blue').changes).toContain(blueOpens);
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
    // Green has no track yet: it is not a line to rank.
    expect(records.longest.map(line => line.id)).toEqual(['red', 'blue', 'pink']);
  });

  test('lists stations for a search by their names, not their ids', () => {
    const network = tinyNetwork();
    network.stations.a!.name = 'Zed';
    const queries = questionsOn(plainFactsOf(network), toTimestamp('1935-01-01'));
    expect(queries.stations().map(station => station.name)).toEqual(['B', 'C', 'D', 'Zed']);
  });
});

describe('FactsUtils', () => {
  describe('planFacts', () => {
    test('counts the stations and track a plan adds, and the lines it builds', () => {
      const facts = planFacts(planOnlyNetwork(), 'first');
      expect(facts.stations).toBe(3);
      // A–B is 0.01° of longitude at 50° N, B–C a little more: about 2 km in all.
      expect(facts.km).toBeGreaterThan(1.8);
      expect(facts.km).toBeLessThan(2.2);
      expect(facts.lines).toEqual([{ id: 'red', name: 'Red', color: { light: '#ff0000', dark: '#ff0000' } }]);
    });
  });

  describe('networkSummary', () => {
    test('sums up a network with a history: its brands, when it opened, its plans, lines and stations', () => {
      expect(networkSummary(tinyNetwork())).toEqual({ networks: ['Metro'], openedYear: 1900, planOnly: false, plans: 1, lines: 4, stations: 4 });
    });

    test('sums up a network never built by its first plan', () => {
      expect(networkSummary(planOnlyNetwork())).toMatchObject({ openedYear: null, planOnly: true, plans: 2, lines: 1, stations: 3 });
    });
  });

  describe('bandOf', () => {
    test('puts a time in the first band it fits, its end included', () => {
      expect(bandOf(0)).toBe(0);
      expect(bandOf(15)).toBe(0);
      expect(bandOf(15.5)).toBe(1);
      expect(bandOf(59)).toBe(3);
    });

    test('puts anything longer in the last band', () => {
      expect(bandOf(240)).toBe(REACH_BANDS.length - 1);
    });
  });

  describe('reachedSegments', () => {
    const segments = [
      { index: 0, stationA: 'a', stationB: 'b' },
      { index: 1, stationA: 'b', stationB: 'c' },
      { index: 2, stationA: 'x', stationB: 'y' },
    ];

    test('times a segment by the mean of its ends, or its one end reached', () => {
      const minutes = new Map([
        ['a', 0],
        ['b', 10],
      ]);
      expect(reachedSegments(minutes, segments)).toEqual([
        { segment: 0, minutes: 5 },
        { segment: 1, minutes: 10 },
      ]);
    });

    test('leaves out a segment with neither end reached', () => {
      expect(reachedSegments(new Map(), segments)).toEqual([]);
    });
  });
});
