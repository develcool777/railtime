import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { Network } from '@railtime/schema/network.types';
import { createPinia, setActivePinia } from 'pinia';

import type { ExplorerQuery } from '~/features/explorer/address/address.types';
import { parseExplorerQuery } from '~/features/explorer/address/address.utils';
import { useExplorerStore } from '~/features/explorer/explorer.store';

/**
 * The explorer's stores, fresh, opened on a network as a page opens on an address.
 *
 * @param query - The address's query; none for a bare page.
 * @param network - The network; the tiny test network unless given.
 * @param outline - Where the city's outline is served; nowhere unless given.
 * @returns The explorer's store; the others are reached through their own `use…Store`.
 */
export const openExplorer = (
  query: ExplorerQuery = {},
  network: Network = tinyNetwork(),
  outline = 'http://127.0.0.1:9/outline.json',
): ReturnType<typeof useExplorerStore> => {
  setActivePinia(createPinia());
  const explorer = useExplorerStore();
  explorer.OPEN({ stored: network, asked: parseExplorerQuery(query), outline });
  return explorer;
};
