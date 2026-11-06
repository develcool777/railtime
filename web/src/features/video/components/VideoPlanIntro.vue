<template>
  <!-- The plan named over the map as it starts to play, under the minimap, clear of the corner and of the middle, where the line grows, whatever its length: how far it has got, its name, and what it would add. The map plays on under it. -->
  <div
    v-if="shown > 0"
    class="absolute top-[28vmin] left-[5vmin] flex max-w-[42vw] flex-col gap-[1.2vmin] rounded-[1.4vmin] bg-[#0b0d10]/85 px-[3.5vmin] py-[3vmin] ring-1 ring-white/10"
    :style="{ opacity: shown, transform: `translateX(${(shown - 1) * 6}vmin)` }">
    <p class="text-[2.8vmin] font-semibold tracking-[0.2em] text-white/70 uppercase">{{ PLAN_STATUSES[plan.status].label }}</p>
    <h2 class="text-[10vmin] leading-none font-extrabold tracking-tight">{{ plan.name }}</h2>
    <p v-if="adds" class="text-[3.4vmin] font-medium text-white/75">{{ adds }}</p>
  </div>
</template>

<script setup lang="ts">
  import type { PlanInfo } from '@railtime/network/facts.types';
  import { computed } from 'vue';
  import { PLAN_STATUSES } from '~/constants/plan.constants';
  import { formatPlanFacts } from '~/utils/format.utils';

  const props = defineProps<{
    /** The plan starting to play. */
    plan: PlanInfo;
    /** How much of it shows, 0 to 1. */
    shown: number;
  }>();

  const adds = computed(() => formatPlanFacts(props.plan.facts.stations, props.plan.facts.km));
</script>
