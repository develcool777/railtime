import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/model/date.utils';
import { NetworkIndex } from '../../../src/model/networkIndex.service';
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
});
