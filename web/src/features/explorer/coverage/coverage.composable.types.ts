import type { CoverageInfo, CoverageYear } from '@railtime/renderer/transitMap.types';
import type { ComputedRef, Ref } from 'vue';

import type { TransitMapBinding } from '~/features/explorer/map/transitMap.composable.types';

/** What `useCoverage` reads. */
export type CoverageInput = {
  binding: TransitMapBinding;
  /** The city, whose outline is loaded. */
  city: string;
};

/** Where the city's outline is: not asked for yet, on its way, there, or none kept for the city. */
export type BoundaryState = 'idle' | 'loading' | 'ready' | 'missing';

/** How much of the city is near a station, on the date shown. */
export type Coverage = {
  boundaryState: Ref<BoundaryState>;
  /** The coverage on the date shown; `null` until the outline is in. */
  coverage: ComputedRef<CoverageInfo | null>;
  /** The covered share year by year; none until the outline is in. */
  history: ComputedRef<CoverageYear[]>;
};
