import { hiddenNetwork } from '@railtime/network/testing/hiddenNetwork';
import { planOnlyNetwork } from '@railtime/network/testing/planOnlyNetwork';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { Network } from '@railtime/schema/network.types';
import { lineId, networkId, planId } from '@railtime/schema/testing/ids';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { useNetworkStore } from '~/features/explorer/network.store';

/**
 * The network with one hidden at first beside it, that one older: `1890-01-01` its timeline's start while it shows.
 *
 * @returns The network.
 */
const olderHiddenNetwork = (): Network => {
  const network = hiddenNetwork();
  network.networks[networkId('rail')]!.start = '1890-01-01';
  return network;
};

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

  test('opens with the lines a network hides at first hidden, its eyes shut and its start not applied', () => {
    const network = useNetworkStore();
    network.OPEN(olderHiddenNetwork(), undefined);
    expect(network.hidden).toEqual(['grey']);
    expect(network.lines.map(line => line.id)).not.toContain('grey');
    expect(network.networkChoices.flatMap(choice => choice.lines).filter(line => !line.shown)).toEqual([expect.objectContaining({ id: 'grey' })]);
    expect(network.range?.start).toBe(Date.UTC(1899, 0, 1));
  });

  test('shows a line hidden at first, and hides it again', () => {
    const network = useNetworkStore();
    network.OPEN(olderHiddenNetwork(), undefined);
    network.SHOW_LINES([lineId('grey')], true);
    expect(network.hidden).toEqual([]);
    expect(network.lines.map(line => line.id)).toContain('grey');
    expect(network.range?.start).toBe(Date.UTC(1890, 0, 1));
    network.SHOW_LINES([lineId('grey')], false);
    expect(network.hidden).toEqual(['grey']);
  });

  test('hides lines and shows them again, keeping the plan picked', () => {
    const network = useNetworkStore();
    network.OPEN(tinyNetwork(), 'extension');
    network.SHOW_LINES([lineId('blue'), lineId('green')], false);
    expect(network.hidden).toEqual(['blue', 'green']);
    network.SHOW_LINES([lineId('blue')], true);
    expect(network.hidden).toEqual(['green']);
    expect(network.pickedPlan).toBe('extension');
  });

  test('shows another plan with the same lines hidden, or the network as built', () => {
    const network = useNetworkStore();
    network.OPEN(tinyNetwork(), undefined);
    network.SHOW_LINES([lineId('green')], false);
    network.SHOW_PLAN(planId('extension'));
    expect(network.plan).toBe('extension');
    expect(network.hidden).toEqual(['green']);
    network.SHOW_PLAN(undefined);
    expect(network.plan).toBeUndefined();
  });
});
