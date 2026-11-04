<template>
  <!-- The network as it is, in numbers and in how much of the city it reaches, and where to see it for yourself. -->
  <div v-if="shown > 0" class="absolute inset-0 grid place-items-center bg-black/60" :style="{ opacity: shown }">
    <div class="flex flex-col items-center gap-[2.4vmin] text-center" :style="{ transform: `translateY(${(1 - shown) * 2}vmin)` }">
      <h2 class="text-[9vmin] leading-none font-extrabold tracking-tight">{{ name }} today</h2>
      <p v-if="stats" class="text-[4vmin] font-medium text-white/85 tabular-nums">
        {{ counted(stats.lines, 'line') }} · {{ counted(stats.stations, 'station') }} · {{ formatNumber(stats.km) }} km
      </p>
      <p v-if="coverage" class="text-[3.4vmin] font-medium text-white/75">
        {{ formatShare(coverage.share) }} of {{ coverage.name }} within {{ formatWalk(coverage.metres) }} of a station
      </p>
      <p class="mt-[2vmin] text-[3vmin] text-white/65">Play any city's history yourself: {{ address }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { CoverageInfo, NetworkStats } from '@railtime/network/facts.types';
  import { counted, formatNumber, formatShare, formatWalk } from '~/utils/format.utils';

  defineProps<{
    /** The city's name. */
    name: string;
    /** The network's size today, once the history has played. */
    stats: NetworkStats | null;
    /** How much of the city it reaches today, as the overview measured it; `null` for a city without an outline. */
    coverage: CoverageInfo | null;
    /** Where the site is, as said (`example.org/railtime`). */
    address: string;
    /** How much of it shows, 0 to 1. */
    shown: number;
  }>();
</script>
