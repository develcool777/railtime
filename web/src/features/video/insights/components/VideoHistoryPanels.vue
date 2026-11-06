<template>
  <!-- Down the left of the map, how the network came to be: the middle stays the network's. -->
  <div class="pointer-events-none absolute top-[4vmin] bottom-[4vmin] left-[2.5vmin] flex flex-col gap-[2vmin]" :style="{ width: `${INSIGHTS_COLUMN_VW}vw` }">
    <VideoPanel v-if="insights.stationYears.length > 0" side="left" title="Stations, year by year" :motion="motion.growth" class="flex-1">
      <template #headline><ReelNumber :count="countUp(insights.stats.stations, motion.growth)" /></template>
      <VideoPanelChart v-slot="{ height }"><GrowthChart :points="insights.stationYears" metric="stations" :height /></VideoPanelChart>
    </VideoPanel>
    <VideoPanel v-if="insights.busiest" key="video-panel-2" side="left" title="Stations opened, by decade" :motion="motion.decades" class="flex-1">
      <template #headline><ReelNumber :count="countUp(insights.busiest.stations, motion.decades)" /> in the {{ insights.busiest.decade }}s</template>
      <VideoPanelChart v-slot="{ height }"><DecadeChart :decades="insights.decades" :busiest="insights.busiest" :height /></VideoPanelChart>
    </VideoPanel>
  </div>
</template>

<script setup lang="ts">
  import { INSIGHTS_COLUMN_VW } from '~/features/video/insights/insights.constants';
  import type { InsightsPanel, PanelMotion, VideoInsights } from '~/features/video/insights/insights.types';
  import { countUp } from '~/features/video/insights/insights.utils';

  defineProps<{
    /** The network's numbers. */
    insights: VideoInsights;
    /** How far each panel has come. */
    motion: Record<InsightsPanel, PanelMotion>;
  }>();
</script>
