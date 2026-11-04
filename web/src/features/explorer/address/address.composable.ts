import { watchThrottled } from '@vueuse/core';
import { useRoute, useRouter } from '#imports';
import { ADDRESS_WRITE_MS } from '~/features/explorer/address/address.constants';
import { sameQuery } from '~/features/explorer/address/address.utils';
import { useExplorerStore } from '~/features/explorer/explorer.store';

/**
 * Writes the explorer's `address` to the address bar, so what is looked at can be shared: an effect,
 * and nothing else, and the only code that writes it. The stores opened on what it said (`OPEN`);
 * from then on it is written from them, playing too, at most every `ADDRESS_WRITE_MS`: a reload or a
 * link opens where the map is.
 */
export const useExplorerAddress = (): void => {
  const store = useExplorerStore();
  const route = useRoute();
  const router = useRouter();
  // Written at once, then at most every ADDRESS_WRITE_MS, the last one always.
  watchThrottled(
    () => store.address,
    next => {
      if (!sameQuery(next, route.query)) void router.replace({ query: next });
    },
    { throttle: ADDRESS_WRITE_MS },
  );
};
