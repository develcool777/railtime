<template>
  <!-- The panels down either side of the map, the year above the right-hand ones: the middle stays the network's. -->
  <div class="pointer-events-none absolute inset-0">
    <div class="absolute top-[4vmin] bottom-[4vmin] left-[2.5vmin] flex w-[27vw] flex-col gap-[2vmin]">
      <VideoPanel v-if="insights.years.length > 0" side="left" title="Stations, year by year" :motion="motion.growth" class="flex-1">
        <template #headline><ReelNumber :count="countUp(insights.stats.stations, motion.growth)" /></template>
        <GrowthChart :points="growthSeries(insights.years, 'stations')" metric="stations" :height="tallChart" />
      </VideoPanel>
      <VideoPanel v-if="insights.busiest" key="video-panel-2" side="left" title="Stations opened, by decade" :motion="motion.decades" class="flex-1">
        <template #headline><ReelNumber :count="countUp(insights.busiest.stations, motion.decades)" /> in the {{ insights.busiest.decade }}s</template>
        <DecadeChart :decades="insights.decades" :busiest="insights.busiest" :height="tallChart" />
      </VideoPanel>
    </div>
    <div class="absolute top-[24vmin] right-[2.5vmin] bottom-[4vmin] flex w-[27vw] flex-col gap-[2vmin]">
      <VideoPanel side="right" :title="linesTitleOf(insights)" :motion="motion.lines" class="flex-none">
        <template #headline>
          <ReelNumber :count="countUp(insights.stats.lines, motion.lines)" /> {{ pluralOf(insights.stats.lines, 'line') }} ·
          <ReelNumber :count="countUp(insights.stats.km, motion.lines)" /> km
        </template>
        <VideoLines :lines="insights.lines" :motion="motion.lines" />
      </VideoPanel>
      <VideoPanel v-if="insights.coverage" side="right" :title="coverageTitleOf(insights.coverage.info)" :motion="motion.coverage" class="flex-1">
        <template #headline><ReelNumber :count="countUp(coverage.value, motion.coverage)" :decimals="coverage.decimals" />%</template>
        <CoverageChart v-if="insights.coverage.years.length > 1" :history="insights.coverage.years" :height="shortChart" />
      </VideoPanel>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { INSIGHTS_CHART_SHARES } from '~/features/video/insights/insights.constants';
  import type { InsightsPanel, PanelMotion, VideoInsights } from '~/features/video/insights/insights.types';
  import { countUp, coverageChartShareOf, coverageTitleOf, linesTitleOf } from '~/features/video/insights/insights.utils';
  import { shareNumberOf } from '~/utils/count.utils';
  import { pluralOf } from '~/utils/format.utils';
  import { growthSeries } from '~/utils/growth.utils';

  const props = defineProps<{
    /** The network's numbers. */
    insights: VideoInsights;
    /** How far each panel has come. */
    motion: Record<InsightsPanel, PanelMotion>;
    /** The frame's height, pixels, which the charts are sized to. */
    frameHeight: number;
  }>();

  const tallChart = computed(() => Math.round(props.frameHeight * INSIGHTS_CHART_SHARES.tall));
  const shortChart = computed(() => Math.round(props.frameHeight * coverageChartShareOf(props.insights.lines.length)));
  const coverage = computed(() => shareNumberOf(props.insights.coverage?.info.share ?? 0));
</script>
