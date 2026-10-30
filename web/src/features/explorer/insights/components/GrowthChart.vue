<template>
  <!-- A click picks the year under the crosshair. -->
  <div class="insight-chart cursor-pointer" :aria-label="summary" role="img" @click="pickHovered">
    <VisXYContainer :data="points" :height="150" :padding="{ top: 10, right: 6 }" :yDomain="[0, yTicks.at(-1) ?? 0]">
      <!-- Straight from year to year: a curve would bulge past what was built. -->
      <VisArea :x="yearOf" :y="valueOf" color="var(--ui-primary)" :opacity="0.1" :curveType="CurveType.Linear" />
      <VisLine :x="yearOf" :y="valueOf" color="var(--ui-primary)" :lineWidth="2" :curveType="CurveType.Linear" />
      <VisPlotline v-if="marked !== null" axis="x" :value="marked" color="var(--ui-text-muted)" :lineWidth="1" />
      <VisAxis type="x" :tickValues="xTicks" :tickFormat="(tick: number | Date) => String(tick)" :gridLine="false" :tickLine="false" />
      <VisAxis type="y" :tickValues="yTicks" :tickFormat="formatTick" :gridLine="true" :domainLine="false" :tickLine="false" />
      <VisCrosshair color="var(--ui-primary)" :template="tooltipOf" :onCrosshairMove="onMove" />
      <VisTooltip />
    </VisXYContainer>
  </div>
</template>

<script setup lang="ts">
  import { CurveType } from '@unovis/ts';
  import { VisArea, VisAxis, VisCrosshair, VisLine, VisPlotline, VisTooltip, VisXYContainer } from '@unovis/vue';
  import { computed, ref } from 'vue';

  import type { GrowthMetric } from '~/features/explorer/insights/insights.types';
  import { formatMetric, niceTicks, yearTicks } from '~/features/explorer/insights/insights.utils';

  type Point = { year: number; value: number };

  const props = defineProps<{
    /** One measure of the network, year by year. */
    points: Point[];
    metric: GrowthMetric;
    /** The year shown on the map, marked; `null` for none. */
    marked: number | null;
  }>();
  const emit = defineEmits<{ pick: [year: number] }>();

  const yearOf = (point: Point) => point.year;
  const valueOf = (point: Point) => point.value;

  const yTicks = computed(() => niceTicks(Math.max(0, ...props.points.map(valueOf))));
  const xTicks = computed(() => yearTicks(props.points[0]?.year ?? 0, props.points.at(-1)?.year ?? 0));
  const formatTick = (tick: number | Date) => Number(tick).toLocaleString('en-GB');

  const summary = computed(() => {
    const first = props.points[0];
    const last = props.points.at(-1);
    return first && last ? `From ${formatMetric(first.value, props.metric)} in ${first.year} to ${formatMetric(last.value, props.metric)} in ${last.year}` : '';
  });

  /** The crosshair's readout: the value leads, the year follows. */
  const tooltipOf = (point: Point) => `<strong>${formatMetric(point.value, props.metric)}</strong> <span class="insight-chart-muted">in ${point.year}</span>`;

  const hovered = ref<number | null>(null);
  const onMove = (_where?: number | Date, point?: Point) => (hovered.value = point?.year ?? null);
  const pickHovered = () => {
    if (hovered.value !== null) emit('pick', hovered.value);
  };
</script>
