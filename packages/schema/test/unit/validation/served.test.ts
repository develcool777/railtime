import { describe, expect, test } from 'vitest';
import { servedBoundary, servedNetwork } from '../../../src/validation/served.utils';

describe('ServedUtils', () => {
  test('takes a file we serve as it is, checked by CI and not again', () => {
    const file = { said: 'as written' };
    expect(servedNetwork(file)).toBe(file);
    expect(servedBoundary(file)).toBe(file);
  });
});
