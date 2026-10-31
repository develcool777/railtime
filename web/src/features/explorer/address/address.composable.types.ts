import type { ExplorerUrlState } from '~/features/explorer/address/address.types';
import type { Section } from '~/features/explorer/explorer.types';
import type { TransitMapBinding } from '~/features/explorer/map/transitMap.composable.types';

/** What `useExplorerAddress` reads. */
export type ExplorerAddressInput = {
  /** The plan shown, if any. */
  plan?: string;
  binding: TransitMapBinding;
  /** What the address said when the page opened. */
  opening: ExplorerUrlState;
  /** The section a page opens on without a tab in its address: left out of the address. */
  openingSection: Section;
};
