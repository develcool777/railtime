import type { Network, Plan } from '@railtime/schema/network.types';
import type { ComputedRef, Ref } from 'vue';

import type { TimeMode } from '~/features/explorer/explorer.types';
import type { ExplorerUrlState } from '~/features/explorer/address/address.types';
import type { TransitMapBinding } from '~/features/explorer/map/transitMap.composable.types';

/** What `useExplorerAddress` reads. */
export type ExplorerAddressInput = {
  network: Network;
  /** The plan shown, if any. */
  plan?: string;
  chosenPlan: ComputedRef<Plan | undefined>;
  binding: TransitMapBinding;
  timeMode: Ref<TimeMode>;
  /** What the address said when the page opened. */
  opening: ExplorerUrlState;
};
