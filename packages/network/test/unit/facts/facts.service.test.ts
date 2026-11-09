import { keysOf } from '@railtime/core/collection.utils';
import { toTimestamp } from '@railtime/core/date.utils';
import { byCodeUnits } from '@railtime/core/text.utils';
import type { PlanId } from '@railtime/schema/network.types';
import { lineId, planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { engineOf } from '../../../src/engine/engine.utils';
import { NetworkFacts } from '../../../src/facts/facts.service';
import { hiddenNetwork } from '../../support/factories/hiddenNetwork.utils';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf as plainFactsOf } from '../../support/facts.utils';

/** Today, for every network here. */
const TODAY = toTimestamp('2026-01-01');

/**
 * The tiny network's facts, `red` given a colour of its own for the dark theme.
 *
 * @param plan - A plan to build on it.
 * @returns Its facts.
 */
const factsOf = (plan?: PlanId) => {
  const network = tinyNetwork();
  network.lines[lineId('red')] = { ...network.lines[lineId('red')]!, darkColor: '#ff6666' };
  return NetworkFacts.create(network, { ...(plan && { plan }), today: TODAY });
};

describe('NetworkFacts', () => {
  test('hides the lines of its networks hidden at first unless asked otherwise, and lists them either way', () => {
    const network = hiddenNetwork();
    const plain = NetworkFacts.create(network, { today: TODAY });
    expect(plain.hidden).toEqual(['grey']);
    expect(plain.lines().map(line => line.id)).not.toContain('grey');
    expect(plain.findStation('x')).toBeNull();
    expect(plain.stationOfCity('x')).toBe('x');
    expect(plain.stationOfCity('nowhere')).toBeNull();
    expect(plain.networkChoices().map(entry => entry.id)).toEqual(['metro', 'rail']);
    const withRail = NetworkFacts.create(network, { today: TODAY, hidden: ['blue', 'nowhere'] });
    expect(withRail.hidden).toEqual(['blue']);
    expect(withRail.lines().map(line => line.id)).toEqual(expect.arrayContaining(['grey']));
    expect(withRail.lines().map(line => line.id)).not.toContain('blue');
    expect(withRail.findStation('x')).toEqual({ id: 'x', name: 'X' });
    // A plan's own station is the city's only while the plan is built.
    expect(plain.stationOfCity('y')).toBeNull();
    expect(NetworkFacts.create(network, { today: TODAY, hidden: [], plan: planId('grey-on') }).stationOfCity('y')).toBe('y');
  });

  test('counts what a plan adds from the map today: its stations not on it, and the track it lays', () => {
    const { facts } = plainFactsOf(tinyNetwork()).plans()[0]!;
    // E and F are new, and so is D: red ran through it past its closing, and the plan calls there.
    expect(facts.stations).toBe(3);
    // D – E alone: F only splits B – C.
    expect(facts.km).toBeCloseTo(1, 1);
    expect(facts.lines).toEqual([{ id: 'red', name: 'Red', color: { light: '#ff0000', dark: '#ff0000' } }]);
    const [first] = NetworkFacts.create(planOnlyNetwork(), { today: TODAY }).plans();
    expect(first?.facts.stations).toBe(3);
    // A–B is 0.01° of longitude at 50° N, B–C a little more: about 2 km in all.
    expect(first?.facts.km).toBeGreaterThan(1.8);
    expect(first?.facts.km).toBeLessThan(2.2);
  });

  test('takes a line out for the years it was drawn as a line hidden, going as what it was, back as itself', () => {
    const network = tinyNetwork();
    // Green, on C – D from 1970, drawn as red until 1975, then as blue until 1990.
    network.lines[lineId('green')] = {
      ...network.lines[lineId('green')]!,
      aliases: [
        { until: '1975-01-01', as: lineId('red'), text: 'Green runs as Blue' },
        { until: '1990-01-01', as: lineId('blue'), text: 'Green becomes its own line' },
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
    const facts = NetworkFacts.create(hiddenNetwork(), { today: TODAY, plan: planId('grey-on') });
    expect(facts.plan).toBeNull();
    expect(NetworkFacts.create(hiddenNetwork(), { today: TODAY, plan: planId('grey-on'), hidden: [] }).plan).toBe('grey-on');
  });

  test('runs from its first date to today, or to its last dated change after it', () => {
    expect(factsOf().range).toEqual({ start: toTimestamp('1899-01-01'), end: TODAY, today: TODAY });
  });

  test('colours a line in both themes: its dark colour, if it has one, else its own', () => {
    const facts = factsOf();
    expect(facts.colorOf(lineId('red'))).toEqual({ light: '#ff0000', dark: '#ff6666' });
    expect(facts.colorOf(lineId('blue'))).toEqual({ light: '#0000ff', dark: '#0000ff' });
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

  test('sketches what is open today, its own today: not a line closed, nor one away for a spell, nor one yet to open', () => {
    const network = tinyNetwork();
    const [first, second, third] = network.segments;
    // In 2026 only A – B is open: B – C closed in 1950, and C – D is away for a spell, until 2030.
    first!.lines = { [lineId('red')]: { open: '1900-01-01' } };
    second!.lines = { [lineId('red')]: { open: '1900-01-01', close: '1950-01-01' } };
    third!.lines = { [lineId('red')]: { open: '1900-01-01', suspended: [{ from: '2020-01-01', until: '2030-01-01' }] } };
    const paths = (today: string) => NetworkFacts.create(network, { today: toTimestamp(today) }).sketch()[0]?.paths;
    expect(paths('2026-01-01')).toEqual([first!.coordinates]);
    expect(paths('2031-01-01')).toEqual([first!.coordinates, third!.coordinates]);
    expect(paths('1940-01-01')).toEqual([first!.coordinates, second!.coordinates, third!.coordinates]);
  });

  test('sketches a line as the map draws it today, whichever line it is drawn as', () => {
    const network = tinyNetwork();
    network.segments[1]!.lines = { [lineId('pink')]: { open: '1900-01-01' } };
    const drawn = (today: string) =>
      NetworkFacts.create(network, { today: toTimestamp(today) })
        .sketch()
        .map(sketch => sketch.line);
    expect(drawn('1950-01-01')).toEqual(['red']);
    expect(drawn('2026-01-01')).toEqual(['pink', 'red']);
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
        .toSorted(byCodeUnits),
    ).toEqual(['a', 'b']);
    expect(later.stations().map(station => station.id)).toContain('d');
    expect(early.station(stationId('b')).lines.find(line => line.id === 'blue')?.opened).toBe('1930-01-01');
    expect(early.routes(stationId('a'), stationId('d'))).toEqual([]);
    expect(later.routes(stationId('a'), stationId('d'))).not.toEqual([]);
  });

  test('answers for today: every dated change on it or before played', () => {
    const facts = factsOf();
    expect(facts.today().stats()).toEqual(facts.asOf(facts.playheads.on(toTimestamp('2026-01-01'))).stats());
  });

  test("names a station as it was called at the moment's date", () => {
    const facts = factsOf();
    expect(facts.asOf(facts.playheads.on(toTimestamp('1915-01-01'))).station(stationId('d')).name).toBe('Old D');
    expect(facts.asOf(facts.playheads.on(toTimestamp('1935-01-01'))).station(stationId('d')).name).toBe('D');
  });

  test('finds a line or station by a string that may be its id, with its name; none it does not have', () => {
    const facts = factsOf();
    expect(facts.findLine('red')).toEqual({ id: 'red', name: 'Red' });
    expect(facts.findStation('a')).toEqual({ id: 'a', name: 'A' });
    expect(facts.findStation('red')).toBeNull();
    expect(facts.findLine('a')).toBeNull();
    expect(facts.findLine('nowhere')).toBeNull();
    // A key every object has is no line's.
    expect(facts.findLine('constructor')).toBeNull();
  });

  test('has a history when some year has a station, and none for a network never built', () => {
    expect(factsOf().hasHistory()).toBe(true);
    expect(factsOf().planOnly).toBe(false);
    const planOnly = NetworkFacts.create(planOnlyNetwork(), { plan: planId('first'), today: TODAY });
    expect(planOnly.hasHistory()).toBe(false);
    expect(planOnly.planOnly).toBe(true);
  });

  test('lists every plan with what it would add, whichever plan is built', () => {
    const plans = factsOf(planId('extension')).plans();
    expect(plans).toEqual(factsOf().plans());
    expect(plans.map(plan => plan.id)).toEqual(keysOf(tinyNetwork().plans ?? {}));
    expect(plans[0]?.facts.stations).toBeGreaterThan(0);
  });

  test('sums the network up as stored, whichever plan is built', () => {
    expect(factsOf(planId('extension')).summary()).toEqual(factsOf().summary());
    expect(factsOf().summary()).toMatchObject({ plans: keysOf(tinyNetwork().plans ?? {}).length, planOnly: false });
  });

  test('sums a network with a history up as today counts it: its brands, when it opened, what is open, closed stations left out', () => {
    // Blue has gone, and D closed on red with green passing it by: red, pink, green; A, B, C.
    expect(factsOf().summary()).toEqual({ networks: ['Metro'], openedYear: 1900, planOnly: false, plans: 1, lines: 3, stations: 3 });
    const { stations, lines } = factsOf().today().stats();
    expect(factsOf().summary()).toMatchObject({ stations, lines });
  });

  test('sums up a network never built by its first plan, whichever is built', () => {
    const summary = { openedYear: null, planOnly: true, plans: 2, lines: 1, stations: 3 };
    expect(NetworkFacts.create(planOnlyNetwork(), { today: TODAY }).summary()).toMatchObject(summary);
    expect(NetworkFacts.create(planOnlyNetwork(), { today: TODAY, plan: planId('first') }).summary()).toMatchObject(summary);
    expect(NetworkFacts.create(planOnlyNetwork(), { today: TODAY, plan: planId('second') }).summary()).toMatchObject(summary);
  });

  test('leaves out of its sums the lines hidden, and the stations only they call at', () => {
    expect(NetworkFacts.create(hiddenNetwork(), { today: TODAY }).summary()).toMatchObject({ lines: 3, stations: 3 });
    expect(NetworkFacts.create(hiddenNetwork(), { today: TODAY, hidden: [] }).summary()).toMatchObject({ lines: 4, stations: 5 });
  });

  test('gives the stops either side of a station on each of its lines, as at the moment', () => {
    const facts = factsOf();
    expect(
      facts
        .asOf(facts.playheads.on(toTimestamp('1935-01-01')))
        .directions(stationId('c'))
        .get(lineId('red')),
    ).toEqual([{ previous: { id: 'b', name: 'B', towards: 'A' }, next: { id: 'd', name: 'D', towards: null } }]);
  });

  test('builds a plan on the network: its changes play last', () => {
    const plain = factsOf();
    const planned = factsOf(planId('extension'));
    expect(planned.plan).toBe('extension');
    expect(planned.changes().length).toBeGreaterThan(plain.changes().length);
    const changes = planned.changes();
    expect(changes.map(change => change.index)).toEqual(engineOf(planned).timeline.steps.map(step => step.index));
    expect(changes[0]).toMatchObject({ kind: 'open', time: toTimestamp('1900-01-01'), title: 'Red line opens', color: { light: '#ff0000' } });
    expect(changes.slice(-2).map(change => change.time)).toEqual([null, null]);
    // Red runs on from D, where it has stopped calling: the extension is named from C, its last stop.
    expect(changes.at(-2)).toMatchObject({ title: 'Red line extended', subtitle: 'C – E' });
  });
});
