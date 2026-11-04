import { planOnlyNetwork } from '@railtime/network/testing/planOnlyNetwork';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';

import { useNetworkStore } from '~/features/explorer/network.store';

describe('NetworkStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('opens the network as built, or with the plan asked for', () => {
    const network = useNetworkStore();
    network.OPEN(tinyNetwork(), undefined);
    expect(network.plan).toBeUndefined();
    expect(network.lines.map(line => line.id)).toContain('red');
    network.OPEN(tinyNetwork(), 'extension');
    expect(network.plan).toBe('extension');
    expect(network.pickedPlan).toBe('extension');
  });

  test('opens a network never built on its first plan, unless another is asked for', () => {
    const network = useNetworkStore();
    network.OPEN(planOnlyNetwork(), undefined);
    expect(network.planOnly).toBe(true);
    expect(network.plan).toBe('first');
    network.OPEN(planOnlyNetwork(), 'second');
    expect(network.plan).toBe('second');
  });

  test('hides lines and shows them again, keeping the plan picked', () => {
    const network = useNetworkStore();
    network.OPEN(tinyNetwork(), 'extension');
    network.SHOW_LINES(['blue', 'green'], false);
    expect(network.hidden).toEqual(['blue', 'green']);
    network.SHOW_LINES(['blue'], true);
    expect(network.hidden).toEqual(['green']);
    expect(network.pickedPlan).toBe('extension');
  });

  test('shows another plan with the same lines hidden, or the network as built', () => {
    const network = useNetworkStore();
    network.OPEN(tinyNetwork(), undefined);
    network.SHOW_LINES(['green'], false);
    network.SHOW_PLAN('extension');
    expect(network.plan).toBe('extension');
    expect(network.hidden).toEqual(['green']);
    network.SHOW_PLAN(undefined);
    expect(network.plan).toBeUndefined();
  });
});
