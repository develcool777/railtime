import { describe, expect, test } from 'vitest';
import { stateChanges } from '../../../src/state/changes.utils';
import { DEFAULT_MAP_STATE } from '../../../src/transitMap.constants';

describe('ChangesUtils', () => {
  describe('stateChanges', () => {
    test('gives nothing for the same state, however it was built', () => {
      expect(stateChanges(DEFAULT_MAP_STATE, { ...DEFAULT_MAP_STATE })).toEqual({});
      const current = { ...DEFAULT_MAP_STATE, overlay: { kind: 'route' as const, from: 'a', to: 'b', preference: 'fastest' as const }, visibleLines: ['a', 'b'] };
      expect(stateChanges(current, { overlay: { preference: 'fastest', to: 'b', from: 'a', kind: 'route' }, visibleLines: ['a', 'b'] })).toEqual({});
    });

    test('gives only the parts that differ', () => {
      expect(stateChanges(DEFAULT_MAP_STATE, { viewMode: '3d', stationLabels: true, cover: { ...DEFAULT_MAP_STATE.cover, left: 340 } })).toEqual({
        viewMode: '3d',
        cover: { ...DEFAULT_MAP_STATE.cover, left: 340 },
      });
    });

    test('tells apart a list in another order, a list from none, and an overlay of another kind', () => {
      const current = { ...DEFAULT_MAP_STATE, visibleLines: ['a', 'b'], overlay: { kind: 'reach' as const, from: 'a' } };
      expect(stateChanges(current, { visibleLines: ['b', 'a'] })).toEqual({ visibleLines: ['b', 'a'] });
      expect(stateChanges(current, { visibleLines: null })).toEqual({ visibleLines: null });
      expect(stateChanges(current, { overlay: { kind: 'coverage' } })).toEqual({ overlay: { kind: 'coverage' } });
      expect(stateChanges(current, { overlay: null })).toEqual({ overlay: null });
    });

    test('leaves out a part given as undefined', () => {
      expect(stateChanges(DEFAULT_MAP_STATE, { viewMode: undefined })).toEqual({});
    });
  });
});
