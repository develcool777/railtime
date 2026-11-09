import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { openExplorer } from '@test/support/factories/explorer.utils';
import { useExplorerAddress } from '~/features/explorer/address/address.composable';
import { ADDRESS_WRITE_MS } from '~/features/explorer/address/address.constants';
import type { ExplorerQuery } from '~/features/explorer/address/address.types';

describe('AddressComposable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * The effect, on the explorer opened on a bare address, writing to a stand-in address bar.
   *
   * @returns The explorer's store, what was written, in order, and the scope the effect runs in.
   */
  const addressBar = () => {
    const explorer = openExplorer();
    const written: ExplorerQuery[] = [];
    const scope = effectScope();
    scope.run(() => {
      useExplorerAddress({
        query: () => written.at(-1) ?? {},
        replace: query => {
          written.push(query);
        },
      });
    });
    return { explorer, written, scope };
  };

  test('writes a change at once, then at most every so often, the last one always', async () => {
    const { explorer, written, scope } = addressBar();
    explorer.SET_TRAINS(true);
    await nextTick();
    expect(written).toEqual([{ trains: 'on' }]);
    explorer.SET_STATION_NAMES(false);
    await nextTick();
    explorer.SET_STREET_NAMES(false);
    await nextTick();
    expect(written).toHaveLength(1);
    vi.advanceTimersByTime(ADDRESS_WRITE_MS);
    expect(written.at(-1)).toEqual({ trains: 'on', names: 'off', streets: 'off' });
    expect(written).toHaveLength(2);
    scope.stop();
  });

  test('keeps to its pace after a late write too, as it does while a change follows every frame', async () => {
    const { explorer, written, scope } = addressBar();
    explorer.SET_TRAINS(true);
    await nextTick();
    explorer.SET_STATION_NAMES(false);
    await nextTick();
    vi.advanceTimersByTime(ADDRESS_WRITE_MS);
    explorer.SET_STREET_NAMES(false);
    await nextTick();
    expect(written).toHaveLength(2);
    vi.advanceTimersByTime(ADDRESS_WRITE_MS);
    expect(written).toHaveLength(3);
    scope.stop();
  });

  test('writes nothing the bar says already', async () => {
    const { explorer, written, scope } = addressBar();
    explorer.SET_TRAINS(true);
    await nextTick();
    vi.advanceTimersByTime(ADDRESS_WRITE_MS * 2);
    expect(written).toHaveLength(1);
    scope.stop();
  });

  test('drops the write waiting when the page goes: it would rewrite the address of the page left for', async () => {
    const { explorer, written, scope } = addressBar();
    explorer.SET_TRAINS(true);
    await nextTick();
    explorer.SET_STATION_NAMES(false);
    await nextTick();
    scope.stop();
    vi.advanceTimersByTime(ADDRESS_WRITE_MS * 2);
    expect(written).toEqual([{ trains: 'on' }]);
  });
});
