<template>
  <div class="insight-chart" :aria-label="summary" role="img">
    <VisXYContainer :data="decades" :height="120" :padding="{ top: 10, right: 6 }" :yDomain="[0, yTicks.at(-1) ?? 0]">
      <VisGroupedBar :x="decadeOf" :y="countOf" color="var(--ui-primary)" :roundedCorners="4" :groupMaxWidth="24" :barPadding="0.15" :events />
      <VisAxis type="x" :tickValues="xTicks" :tickFormat="(tick: number | Date) => `${tick}s`" :gridLine="false" :tickLine="false" />
      <VisAxis type="y" :tickValues="yTicks" :gridLine="true" :domainLine="false" :tickLine="false" />
      <VisTooltip :triggers />
    </VisXYContainer>
  </div>
</template>

<script setup lang="ts">
  import type { DecadeOpenings } from '@railtime/renderer/transitMap.types';
  import { GroupedBar } from '@unovis/ts';
  import { VisAxis, VisGroupedBar, VisTooltip, VisXYContainer } from '@unovis/vue';
  import { computed } from 'vue';

  import { formatMetric, niceTicks, yearTicks } from '~/features/explorer/insights/insights.utils';

  const props = defineProps<{
    /** How many stations first opened in each decade. */
    decades: DecadeOpenings[];
  }>();
  const emit = defineEmits<{ pick: [year: number] }>();

  const decadeOf = (entry: DecadeOpenings) => entry.decade;
  const countOf = (entry: DecadeOpenings) => entry.stations;

  const yTicks = computed(() => niceTicks(Math.max(0, ...props.decades.map(countOf))));
  // Every other decade's mark at most: the axis is narrow.
  const xTicks = computed(() => {
    const first = props.decades[0]?.decade ?? 0;
    const last = props.decades.at(-1)?.decade ?? 0;
    return yearTicks(first, last).filter(year => year % 10 === 0);
  });

  const summary = computed(() => {
    const busiest = [...props.decades].sort((first, second) => second.stations - first.stations)[0];
    return busiest ? `Stations opened by decade; the most, ${busiest.stations}, in the ${busiest.decade}s` : '';
  });

  // Each bar's readout, and a click on it shows the map at its decade's end.
  const triggers = {
    [GroupedBar.selectors.bar]: (entry: DecadeOpenings) =>
      `<strong>${formatMetric(entry.stations, 'stations')}</strong> <span class="insight-chart-muted">opened in the ${entry.decade}s</span>`,
  };
  const events = {
    [GroupedBar.selectors.bar]: { click: (entry: DecadeOpenings) => emit('pick', entry.decade + 9) },
  };
</script>
