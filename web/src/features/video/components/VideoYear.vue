<template>
  <!-- The year shown, large, or how far a plan has got, smaller for being words, and the network's size then, under it; a soft dark behind them, so what the map draws never runs through them. -->
  <div v-if="shown > 0" class="absolute top-[4vmin] right-[5vmin] isolate flex flex-col items-end" :style="{ opacity: shown }">
    <div class="absolute -inset-[5vmin] -z-10 bg-[radial-gradient(closest-side,#0b0d10e6_50%,transparent)]" />
    <p v-if="plan" class="text-[7vmin] leading-none font-extrabold tracking-tight">{{ PLAN_STATUSES[plan.status].label }}</p>
    <p v-else class="text-[13vmin] leading-none font-extrabold tracking-tight"><ReelNumber :count="counts.year" ungrouped /></p>
    <p class="mt-[1vmin] text-[2.8vmin] font-medium text-white/75" :style="{ opacity: totals }">
      <ReelNumber :count="counts.stations" /> {{ pluralOf(counts.stations.now, 'station') }} · <ReelNumber :count="counts.km" /> km
    </p>
  </div>
</template>

<script setup lang="ts">
  import type { PlanInfo } from '@railtime/network/facts.types';
  import { PLAN_STATUSES } from '~/constants/plan.constants';
  import type { Count, CountedSizes } from '~/utils/count.types';
  import { pluralOf } from '~/utils/format.utils';

  defineProps<{
    /** The year and the network's size, as they count to where the history is. */
    counts: Record<keyof CountedSizes, Count>;
    /** The plan laid on the network; `null` for none. */
    plan: PlanInfo | null;
    /** How much of it shows, 0 to 1. */
    shown: number;
    /** How much of the network's size shows in it, 0 to 1. */
    totals: number;
  }>();
</script>
