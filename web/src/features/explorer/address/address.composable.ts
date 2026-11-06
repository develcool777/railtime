import { useTimeoutFn } from '@vueuse/core';
import { watch } from 'vue';
import { ADDRESS_WRITE_MS } from '~/features/explorer/address/address.constants';
import type { AddressBar } from '~/features/explorer/address/address.types';
import { sameQuery } from '~/features/explorer/address/address.utils';
import { useExplorerStore } from '~/features/explorer/explorer.store';

/**
 * Writes the explorer's `address` to the address bar, so what is looked at can be shared: an effect,
 * and nothing else, and the only code that writes it. The stores opened on what it said (`OPEN`);
 * from then on it is written from them, playing too: a reload or a link opens where the map is.
 *
 * Written at once, then at most every `ADDRESS_WRITE_MS`, the last one always; and never once the page
 * has gone. The wait is `useTimeoutFn`'s, which ends with the scope: playing, a write is always waiting,
 * and one left to run would rewrite the address of the page left for.
 *
 * @param bar - The address bar.
 */
export const useExplorerAddress = (bar: AddressBar): void => {
  const store = useExplorerStore();
  /** Says what the store says, if the bar does not, and waits before saying more. */
  const write = () => {
    if (sameQuery(store.address, bar.query())) return;
    bar.replace(store.address);
    wait.start();
  };
  const wait = useTimeoutFn(write, ADDRESS_WRITE_MS, { immediate: false });
  watch(
    () => store.address,
    () => {
      if (!wait.isPending.value) write();
    },
  );
};
