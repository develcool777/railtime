import { describe, expect, test } from 'vitest';
import { toTimestamp } from '@railtime/core/date.utils';
import { NetworkFacts } from '../../../src/facts/facts.service';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf as plainFactsOf, questionsOn } from '../../support/facts.utils';

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

/**
 * The moment just after a date: the cursor past every step on it or before.
 *
 * @param facts - The network's facts.
 * @param date - The date.
 * @returns The moment.
 */
const momentOf = (facts: NetworkFacts, date: string) => ({ cursor: facts.engine.timeline.cursorAt(toTimestamp(date)), time: toTimestamp(date) });

describe('NetworkFacts', () => {
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

  test('answers for the moment it is asked about, and for no other', () => {
    const facts = factsOf();
    const early = facts.asOf(momentOf(facts, '1905-01-01'));
    const later = facts.asOf(momentOf(facts, '1935-01-01'));
    expect(
      early
        .stations()
        .map(station => station.id)
        .sort(),
    ).toEqual(['a', 'b']);
    expect(later.stations().map(station => station.id)).toContain('d');
    expect(early.station('b').lines.find(line => line.id === 'blue')?.opened).toBe('1930-01-01');
    expect(early.route('a', 'd', 'fastest')).toBeNull();
    expect(later.route('a', 'd', 'fastest')).not.toBeNull();
  });

  test('answers for today: every dated change on it or before played', () => {
    const facts = factsOf();
    expect(facts.today().stats()).toEqual(facts.asOf(momentOf(facts, '2026-01-01')).stats());
  });

  test("names a station as it was called at the moment's date", () => {
    const facts = factsOf();
    expect(facts.asOf(momentOf(facts, '1915-01-01')).station('d').name).toBe('Old D');
    expect(facts.asOf(momentOf(facts, '1935-01-01')).station('d').name).toBe('D');
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
    expect(facts.asOf(momentOf(facts, '1935-01-01')).directions('c').get('red')).toEqual([
      { previous: { id: 'b', name: 'B', towards: 'A' }, next: { id: 'd', name: 'D', towards: null } },
    ]);
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
    expect(changes.at(-2)).toMatchObject({ title: 'Red line extended', subtitle: 'D – E' });
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
      lines: [{ id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: '1910-01-01', closed: '1960-01-01' }],
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
      { id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: '1920-06-01' },
      { id: 'green', name: 'Green line', color: { light: '#00aa00', dark: '#00aa00' }, opened: '1970-01-01' },
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
    const route = queries.route('a', 'd', 'fastest');
    expect(route).toMatchObject({ from: { id: 'a', name: 'A' }, to: { id: 'd', name: 'D' }, changes: 0 });
    expect(route?.legs).toEqual([expect.objectContaining({ kind: 'ride', line: 'red', lineName: 'Red line', color: { light: '#ff0000', dark: '#ff0000' } })]);
    expect(route?.segments).toEqual([[0, 1, 2]]);
    const before = queriesOn('1899-06-01');
    expect(before.queries.route('a', 'd', 'fastest')).toBeNull();
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

  test('dates a line closed at a station when all its track there has, before 1970 too', () => {
    // Blue left B – C in 1950, after a spell away in the 1940s.
    const { queries } = queriesOn('1955-01-01');
    expect(queries.station('b').lines).toEqual([
      { id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: '1900-01-01' },
      { id: 'pink', name: 'Pink line', color: { light: '#ff88cc', dark: '#ff88cc' }, opened: '1900-01-01' },
      { id: 'blue', name: 'Blue line', color: { light: '#0000ff', dark: '#0000ff' }, opened: '1930-01-01', closed: '1950-01-01' },
    ]);
  });

  test("lists a plan's undated line at a station of its own, and a former name from the day it was dropped", () => {
    const queries = questionsOn(plainFactsOf(tinyNetwork(), 'extension'), 'future');
    expect(queries.station('e').lines).toEqual([{ id: 'red', name: 'Red line', color: { light: '#ff0000', dark: '#ff0000' }, opened: null }]);
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
