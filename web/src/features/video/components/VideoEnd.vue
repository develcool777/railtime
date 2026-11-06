<template>
  <!-- Along the foot, under the network: what it is, its size, and where to see it for yourself. -->
  <div
    v-if="shown > 0"
    class="absolute inset-x-[30vw] bottom-[3vmin] flex flex-col items-center gap-[0.8vmin] text-center"
    :style="{ opacity: shown, transform: `translateY(${(1 - shown) * 2}vmin)` }">
    <h2 class="text-[6vmin] leading-none font-extrabold tracking-tight">{{ name }} today</h2>
    <p v-if="stats" class="text-[2.6vmin] font-medium text-white/85">
      <ReelNumber :count="countOf(0, stats.lines, counted)" /> {{ pluralOf(stats.lines, 'line') }} · <ReelNumber :count="countOf(0, stats.stations, counted)" />
      {{ pluralOf(stats.stations, 'station') }} · <ReelNumber :count="countOf(0, stats.km, counted)" /> km
    </p>
    <p class="text-[2.2vmin] text-white/65">
      Play any city's history yourself: <span class="font-semibold text-white">{{ address }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
  import type { NetworkStats } from '@railtime/network/facts.types';
  import { countOf } from '~/utils/count.utils';
  import { pluralOf } from '~/utils/format.utils';

  defineProps<{
    /** The city's name. */
    name: string;
    /** The network's size where the video ends, once it has played. */
    stats: NetworkStats | null;
    /** How long its numbers have counted, ms. */
    counted: number;
    /** Where the site is, as said (`example.org/railtime`). */
    address: string;
    /** How much of it shows, 0 to 1. */
    shown: number;
  }>();
</script>
