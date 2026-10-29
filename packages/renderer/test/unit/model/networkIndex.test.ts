import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/model/date.utils';
import { NetworkIndex } from '../../../src/model/networkIndex.service';
import { buildPlan } from '@railtime/schema/plan.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

describe('NetworkIndex', () => {
  test('names a station by its former name until the day it changed', () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.stationName('d', toTimestamp('1924-12-31'))).toBe('Old D');
    expect(index.stationName('d', toTimestamp('1925-01-01'))).toBe('D');
    expect(index.stationName('d')).toBe('D');
  });

  test('makes each period of a suspended line its own line segment, linked to the next', () => {
    const index = new NetworkIndex(tinyNetwork());
    const [before, after, ...rest] = index.lineSegments.filter(lineSegment => lineSegment.line === 'blue');
    expect(rest).toEqual([]);
    expect(before).toMatchObject({ opens: toTimestamp('1930-01-01'), closes: toTimestamp('1940-01-01'), previous: null, next: after });
    expect(after).toMatchObject({ opens: toTimestamp('1945-01-01'), closes: toTimestamp('1950-01-01'), previous: before, next: null });
  });

  test("knows each station's transfers, both ways", () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.transfersAt('a')).toEqual(['d']);
    expect(index.transfersAt('d')).toEqual(['a']);
    expect(index.transfersAt('b')).toEqual([]);
  });

  test('labels a station with its name, then its names in other languages, as of a date', () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.stationLabel('d')).toBe('D\nД');
    expect(index.stationLabel('d', toTimestamp('1924-12-31'))).toBe('Old D\nСтарий Д');
    expect(index.stationLabel('c')).toBe('C');
    expect(index.stationName('d')).toBe('D');
    expect(index.lineName('red')).toBe('Red line');
  });

  test('leaves out another name that is the same as the English one', () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.otherNames({ name: 'Arena', names: { uk: 'Арена', pl: 'Arena' } })).toEqual(['Арена']);
  });

  test('knows when each line first ran as itself, and that a line only a plan builds has not', () => {
    const network = tinyNetwork();
    network.plans = {
      ...network.plans,
      newLine: {
        name: 'New line',
        status: 'planned',
        lines: { purple: { name: 'Purple', network: 'metro', mode: 'metro', color: '#800080' } },
        sections: [{ line: 'purple', stations: ['a', 'b'] }],
      },
    };
    const plan = buildPlan(network, 'newLine');
    const index = new NetworkIndex(plan.network, plan.sections);
    expect(index.lineOpens('red')).toBe(toTimestamp('1900-01-01'));
    expect(index.lineOpens('green')).toBe(toTimestamp('1970-01-01'));
    // Drawn as red until 1990.
    expect(index.lineOpens('pink')).toBe(toTimestamp('1990-01-01'));
    expect(index.lineOpens('purple')).toBe(Infinity);
  });
});
