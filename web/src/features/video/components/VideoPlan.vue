<template>
  <!-- A plan about to play, over today's network: how far it has got, its name, and what it would add. -->
  <div v-if="shown > 0" class="absolute inset-0 grid place-items-center bg-black/55" :style="{ opacity: shown }">
    <div class="flex flex-col items-center gap-[2vmin] text-center" :style="{ transform: `translateY(${(1 - shown) * 2}vmin)` }">
      <p class="text-[3vmin] font-semibold tracking-[0.2em] text-white/70 uppercase">{{ PLAN_STATUSES[plan.status].label }}</p>
      <h2 class="text-[9vmin] leading-none font-extrabold tracking-tight">{{ plan.name }}</h2>
      <p v-if="adds" class="text-[3.6vmin] font-medium text-white/75">{{ adds }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { PlanInfo } from '@railtime/network/facts.types';
  import { computed } from 'vue';
  import { PLAN_STATUSES } from '~/constants/plan.constants';
  import { formatPlanFacts } from '~/utils/format.utils';

  const props = defineProps<{
    /** The plan about to play. */
    plan: PlanInfo;
    /** How much of it shows, 0 to 1. */
    shown: number;
  }>();

  const adds = computed(() => formatPlanFacts(props.plan.facts.stations, props.plan.facts.km));
</script>
