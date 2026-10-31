import { describe, expect, test } from 'vitest';
import { PropsReconciler } from '../../../src/state/reconciler.service';
import { DEFAULT_MAP_PROPS } from '../../../src/transitMap.constants';
import type { MapProps } from '../../../src/transitMap.types';
import { stateChanges } from '../../../src/state/reconciler.utils';

/**
 * A reconciler whose effects say which props they ran for.
 *
 * @returns It, and the props run for, in order.
 */
const recording = () => {
  const ran: (keyof MapProps)[] = [];
  const keys = Object.keys(DEFAULT_MAP_PROPS) as (keyof MapProps)[];
  const effects = Object.fromEntries(keys.map(key => [key, () => void ran.push(key)])) as Record<keyof MapProps, () => void>;
  return { reconciler: new PropsReconciler(DEFAULT_MAP_PROPS, effects), ran };
};

describe('PropsReconciler', () => {
  test('keeps props given before the map is ready, then runs every effect once as it starts', () => {
    const { reconciler, ran } = recording();
    reconciler.update({ viewMode: '3d', selectedStation: 'a' });
    expect(ran).toEqual([]);
    expect(reconciler.current).toMatchObject({ viewMode: '3d', selectedStation: 'a' });
    reconciler.start();
    expect(ran).toEqual(Object.keys(DEFAULT_MAP_PROPS));
  });

  test('once started, runs the effect of each prop that changed, and nothing for the same props again', () => {
    const { reconciler, ran } = recording();
    reconciler.start();
    ran.length = 0;
    reconciler.update({ viewMode: '3d', stationLabels: true });
    expect(ran).toEqual(['viewMode']);
    reconciler.update({ ...reconciler.current });
    expect(ran).toEqual(['viewMode']);
  });

  test("runs the effects in the props' own order, whatever the order given: what the camera frames last", () => {
    const { reconciler, ran } = recording();
    reconciler.start();
    ran.length = 0;
    reconciler.update({ selectedStation: 'a', cover: { top: 0, right: 0, bottom: 0, left: 300 } });
    expect(ran).toEqual(['cover', 'selectedStation']);
  });
});

describe('ReconcilerUtils', () => {
  describe('stateChanges', () => {
    test('gives nothing for the same state, however it was built', () => {
      expect(stateChanges(DEFAULT_MAP_PROPS, { ...DEFAULT_MAP_PROPS })).toEqual({});
      const current = {
        ...DEFAULT_MAP_PROPS,
        overlay: { kind: 'route' as const, from: 'a', to: 'b', preference: 'fastest' as const },
        visibleLines: ['a', 'b'],
      };
      expect(stateChanges(current, { overlay: { preference: 'fastest', to: 'b', from: 'a', kind: 'route' }, visibleLines: ['a', 'b'] })).toEqual({});
    });

    test('gives only the parts that differ', () => {
      expect(stateChanges(DEFAULT_MAP_PROPS, { viewMode: '3d', stationLabels: true, cover: { ...DEFAULT_MAP_PROPS.cover, left: 340 } })).toEqual({
        viewMode: '3d',
        cover: { ...DEFAULT_MAP_PROPS.cover, left: 340 },
      });
    });

    test('tells apart a list in another order, a list from none, and an overlay of another kind', () => {
      const current = { ...DEFAULT_MAP_PROPS, visibleLines: ['a', 'b'], overlay: { kind: 'reach' as const, from: 'a' } };
      expect(stateChanges(current, { visibleLines: ['b', 'a'] })).toEqual({ visibleLines: ['b', 'a'] });
      expect(stateChanges(current, { visibleLines: null })).toEqual({ visibleLines: null });
      expect(stateChanges(current, { overlay: { kind: 'coverage' } })).toEqual({ overlay: { kind: 'coverage' } });
      expect(stateChanges(current, { overlay: null })).toEqual({ overlay: null });
    });

    test('leaves out a part given as undefined', () => {
      expect(stateChanges(DEFAULT_MAP_PROPS, { viewMode: undefined })).toEqual({});
    });
  });
});
