import { describe, expect, test } from 'vitest';
import { NetworkFacts } from '@railtime/network/facts.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { PropsReconciler, stateChanges } from '../../../src/support/reconciler.service';
import { DEFAULT_MAP_PROPS } from '../../../src/transitMap.constants';
import type { MapProps } from '../../../src/transitMap.types';

/** The defaults, on the tiny network: the network first, as the map orders them. */
const PROPS: MapProps = { facts: NetworkFacts.create(tinyNetwork()), ...DEFAULT_MAP_PROPS };

/**
 * A reconciler whose effects say which props they ran for.
 *
 * @returns It, and the props run for, in order.
 */
const recording = () => {
  const ran: (keyof MapProps)[] = [];
  const keys = Object.keys(PROPS) as (keyof MapProps)[];
  const effects = Object.fromEntries(keys.map(key => [key, () => void ran.push(key)])) as Record<keyof MapProps, () => void>;
  return { reconciler: new PropsReconciler(PROPS, effects), ran };
};

describe('PropsReconciler', () => {
  test('keeps props given before the map is ready, then runs every effect once as it starts', () => {
    const { reconciler, ran } = recording();
    reconciler.update({ viewMode: '3d', selectedStation: 'a' });
    expect(ran).toEqual([]);
    expect(reconciler.current).toMatchObject({ viewMode: '3d', selectedStation: 'a' });
    reconciler.start();
    expect(ran).toEqual(Object.keys(PROPS));
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
      expect(stateChanges(PROPS, { ...PROPS })).toEqual({});
      const current = {
        ...PROPS,
        overlay: { kind: 'route' as const, from: 'a', to: 'b', preference: 'fastest' as const },
        visibleLines: ['a', 'b'],
      };
      expect(stateChanges(current, { overlay: { preference: 'fastest', to: 'b', from: 'a', kind: 'route' }, visibleLines: ['a', 'b'] })).toEqual({});
    });

    test('gives only the parts that differ', () => {
      expect(stateChanges(PROPS, { viewMode: '3d', stationLabels: true, cover: { ...PROPS.cover, left: 340 } })).toEqual({
        viewMode: '3d',
        cover: { ...PROPS.cover, left: 340 },
      });
    });

    test('tells apart a list in another order, a list from none, and an overlay of another kind', () => {
      const current = { ...PROPS, visibleLines: ['a', 'b'], overlay: { kind: 'reach' as const, from: 'a' } };
      expect(stateChanges(current, { visibleLines: ['b', 'a'] })).toEqual({ visibleLines: ['b', 'a'] });
      expect(stateChanges(current, { visibleLines: null })).toEqual({ visibleLines: null });
      expect(stateChanges(current, { overlay: { kind: 'coverage' } })).toEqual({ overlay: { kind: 'coverage' } });
      expect(stateChanges(current, { overlay: null })).toEqual({ overlay: null });
    });

    test('leaves out a part given as undefined', () => {
      expect(stateChanges(PROPS, { viewMode: undefined })).toEqual({});
    });

    test('tells a network by its instance, never taken apart: the same network is no change, another one is', () => {
      expect(stateChanges(PROPS, { facts: PROPS.facts })).toEqual({});
      const another = NetworkFacts.create(tinyNetwork());
      expect(stateChanges(PROPS, { facts: another })).toEqual({ facts: another });
    });
  });
});
