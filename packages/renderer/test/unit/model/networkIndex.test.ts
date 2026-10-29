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
});
