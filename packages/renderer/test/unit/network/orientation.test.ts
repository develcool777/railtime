import { describe, expect, test } from 'vitest';
import { NetworkIndex } from '../../../src/network/index.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

describe('OrientationUtils', () => {
  test('runs a line through each station: one segment ends where the next starts', () => {
    const index = new NetworkIndex(tinyNetwork());
    const [first, second, third] = index.segments;
    const endOf = (segment = first!) => (segment.travel === 1 ? segment.stationB : segment.stationA);
    const startOf = (segment = first!) => (segment.travel === 1 ? segment.stationA : segment.stationB);
    expect(endOf(first)).toBe(startOf(second));
    expect(endOf(second)).toBe(startOf(third));
  });
});
