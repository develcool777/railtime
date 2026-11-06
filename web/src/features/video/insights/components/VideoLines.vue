<template>
  <!-- The longest lines, each in its own colour: the map's key as well as a chart. -->
  <ul class="flex min-h-0 flex-1 flex-col justify-between gap-[0.5vmin]">
    <li v-for="(line, place) in lines" :key="line.id">
      <div class="flex justify-between gap-[1vmin] text-[1.9vmin] leading-tight font-medium">
        <span class="truncate">{{ line.name }}</span>
        <span class="flex-none text-white/60 tabular-nums">{{ formatNumber(line.km) }} km</span>
      </div>
      <div class="mt-[0.3vmin] h-[0.7vmin] rounded-full" :style="{ width: `${(shares[place] ?? 0) * 100}%`, background: lineColor(line.color) }" />
    </li>
  </ul>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { VideoInsights } from '~/features/video/insights/insights.types';
  import { sharesOf } from '~/features/video/insights/insights.utils';
  import { formatNumber, lineColor } from '~/utils/format.utils';

  const props = defineProps<{
    /** The longest lines, longest first. */
    lines: VideoInsights['lines'];
  }>();

  const shares = computed(() => sharesOf(props.lines.map(line => line.km)));
</script>
