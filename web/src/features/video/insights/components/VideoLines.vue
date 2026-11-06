<template>
  <!-- The longest lines, each in its own colour: the map's key as well as a chart. To a tenth, so they add up to the panel's total as written. -->
  <ul class="flex flex-col gap-[1.2vmin]">
    <li v-for="(line, place) in lines" :key="line.id">
      <div class="flex justify-between gap-[1vmin] text-[1.9vmin] leading-tight font-medium">
        <span class="truncate">{{ line.name }}</span>
        <span class="flex-none text-white/60"><ReelNumber :count="countUp(line.km * 10, motion)" :decimals="1" /> km</span>
      </div>
      <div class="mt-[0.3vmin] h-[0.7vmin] rounded-full" :style="{ width: `${(shares[place] ?? 0) * 100}%`, background: lineColor(line.color) }" />
    </li>
  </ul>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { PanelMotion, VideoInsights } from '~/features/video/insights/insights.types';
  import { countUp, sharesOf } from '~/features/video/insights/insights.utils';
  import { lineColor } from '~/utils/format.utils';

  const props = defineProps<{
    /** The longest lines, longest first. */
    lines: VideoInsights['lines'];
    /** How far its panel has come. */
    motion: PanelMotion;
  }>();

  const shares = computed(() => sharesOf(props.lines.map(line => line.km)));
</script>
