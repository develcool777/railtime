<template>
  <YearChart :points :label="METRIC_LABELS[metric]" :format="formatNumber" :height :summary @pick="emit('pick', $event)" />
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { formatNumber } from '~/utils/format.utils';
  import type { GrowthMetric } from '~/utils/growth.types';
  import { formatMetric } from '~/utils/growth.utils';

  const props = defineProps<{
    /** One measure of the network, year by year. */
    points: { year: number; value: number }[];
    /** Which measure it is: stations, kilometres or lines, for its label and numbers. */
    metric: GrowthMetric;
    /** How tall it is, pixels. */
    height: number;
  }>();

  const emit = defineEmits<{ pick: [year: number] }>();

  /** What each measure is called in the readout. */
  const METRIC_LABELS: Record<GrowthMetric, string> = { stations: 'Stations', km: 'Track', lines: 'Lines' };

  const summary = computed(() => {
    const first = props.points[0];
    const last = props.points.at(-1);
    return first && last ? `From ${formatMetric(first.value, props.metric)} in ${first.year} to ${formatMetric(last.value, props.metric)} in ${last.year}` : '';
  });
</script>
