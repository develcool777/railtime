<template>
  <!-- The year shown, large, or how far a plan has got (`videoYearOf`), smaller for being words, and the network's size then, under it. -->
  <div v-if="shown > 0" class="absolute top-[4vmin] right-[5vmin] flex flex-col items-end" :style="{ opacity: shown }">
    <p class="leading-none font-extrabold tracking-tight tabular-nums" :class="plan ? 'text-[7vmin]' : 'text-[13vmin]'">{{ year }}</p>
    <p class="mt-[1vmin] text-[2.8vmin] font-medium text-white/75 tabular-nums">{{ counted(stats.stations, 'station') }} · {{ formatNumber(stats.km) }} km</p>
  </div>
</template>

<script setup lang="ts">
  import type { NetworkStats, PlanInfo } from '@railtime/network/facts.types';
  import type { TimeState } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';
  import { videoYearOf } from '~/features/video/video.utils';
  import { counted, formatNumber } from '~/utils/format.utils';

  const props = defineProps<{
    /** Where the history is. */
    time: TimeState;
    /** The network's size, as it counts to where the history is. */
    stats: NetworkStats;
    /** The plan laid on the network; `null` for none. */
    plan: PlanInfo | null;
    /** How much of it shows, 0 to 1. */
    shown: number;
  }>();

  const year = computed(() => videoYearOf(props.time, props.plan));
</script>
