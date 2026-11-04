<template>
  <!-- The year shown, large, and the network's size then, under it. -->
  <div v-if="shown > 0" class="absolute top-[4vmin] right-[5vmin] flex flex-col items-end" :style="{ opacity: shown }">
    <p class="text-[13vmin] leading-none font-extrabold tracking-tight tabular-nums">{{ year }}</p>
    <p class="mt-[1vmin] text-[2.8vmin] font-medium text-white/75 tabular-nums">
      {{ counted(time.stats.stations, 'station') }} · {{ formatNumber(time.stats.km) }} km
    </p>
  </div>
</template>

<script setup lang="ts">
  import { yearOf } from '@railtime/core/date.utils';
  import type { TimeState } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';
  import { counted, formatNumber } from '~/utils/format.utils';

  const props = defineProps<{
    /** Where the history is. */
    time: TimeState;
    /** How much of it shows, 0 to 1. */
    shown: number;
  }>();

  const year = computed(() => yearOf(props.time.time));
</script>
