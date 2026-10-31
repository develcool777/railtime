<template>
  <!-- A click picks the year under the crosshair. -->
  <UChart
    type="area"
    :data="points"
    index="year"
    :categories="[{ key: 'value', label: METRIC_LABELS[metric], color: 'primary' }]"
    :format="formatNumber"
    :height="150"
    :ariaLabel="summary"
    class="cursor-pointer"
    @select="point => point && emit('pick', Number(point.datum.x))" />
</template>

<script setup lang="ts">
  import { computed } from 'vue';

  import type { GrowthMetric } from '~/features/explorer/insights/insights.types';
  import { formatMetric } from '~/features/explorer/insights/insights.utils';
  import { formatNumber } from '~/utils/format.utils';

  /** What each measure is called in the readout. */
  const METRIC_LABELS: Record<GrowthMetric, string> = { stations: 'Stations', km: 'Track', lines: 'Lines' };

  const props = defineProps<{
    /** One measure of the network, year by year. */
    points: { year: number; value: number }[];
    metric: GrowthMetric;
  }>();
  const emit = defineEmits<{ pick: [year: number] }>();

  const summary = computed(() => {
    const first = props.points[0];
    const last = props.points.at(-1);
    return first && last ? `From ${formatMetric(first.value, props.metric)} in ${first.year} to ${formatMetric(last.value, props.metric)} in ${last.year}` : '';
  });
</script>
