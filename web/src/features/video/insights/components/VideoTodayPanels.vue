<template>
  <!-- What the network is now, under the year: its lines take the room they need, and its coverage what they leave. -->
  <div class="flex flex-col gap-[2vmin]" :style="{ width: `${INSIGHTS_COLUMN_VW}vw` }">
    <VideoPanel side="right" :title="linesTitleOf(insights)" :motion="motion.lines" class="flex-none">
      <template #headline>
        <ReelNumber :count="countUp(insights.stats.lines, motion.lines)" /> {{ pluralOf(insights.stats.lines, 'line') }} ·
        <ReelNumber :count="countUp(insights.stats.km, motion.lines)" /> km
      </template>
      <VideoLines :lines="insights.lines" :motion="motion.lines" />
    </VideoPanel>
    <VideoPanel v-if="insights.coverage" side="right" :title="coverageTitleOf(insights.coverage.info)" :motion="motion.coverage" class="flex-1">
      <template #headline><ReelNumber :count="countUp(coverage.value, motion.coverage)" :decimals="coverage.decimals" />%</template>
      <VideoPanelChart v-if="insights.coverage.years.length > 1" v-slot="{ height }">
        <CoverageChart :history="insights.coverage.years" :height />
      </VideoPanelChart>
    </VideoPanel>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { INSIGHTS_COLUMN_VW } from '~/features/video/insights/insights.constants';
  import type { InsightsPanel, PanelMotion, VideoInsights } from '~/features/video/insights/insights.types';
  import { countUp, coverageTitleOf, linesTitleOf } from '~/features/video/insights/insights.utils';
  import { shareNumberOf } from '~/utils/count.utils';
  import { pluralOf } from '~/utils/format.utils';

  const props = defineProps<{
    /** The network's numbers. */
    insights: VideoInsights;
    /** How far each panel has come. */
    motion: Record<InsightsPanel, PanelMotion>;
  }>();

  const coverage = computed(() => shareNumberOf(props.insights.coverage?.info.share ?? 0));
</script>
