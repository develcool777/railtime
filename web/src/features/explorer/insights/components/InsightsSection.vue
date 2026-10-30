<template>
  <div class="flex flex-col gap-6 px-4 pt-3 pb-6">
    <p v-if="!growth || growth.years.length < 2" class="text-muted text-sm">This network has no history yet: only plans.</p>
    <template v-else>
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <h3 class="eyebrow text-muted">Growth</h3>
          <SegmentedControl v-model="metric" :items="METRICS" label="What the chart measures" />
        </div>
        <GrowthChart :points :metric :marked="year" @pick="emit('year', $event)" />
        <p class="text-dimmed text-xs">Pick a year on the chart to see the map then.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="eyebrow text-muted">Stations opened, by decade</h3>
        <DecadeChart :decades="growth.decades" @pick="emit('year', $event)" />
      </section>
    </template>

    <template v-if="records">
      <section class="flex flex-col gap-1">
        <h3 class="eyebrow text-muted px-2 pb-1">Open longest{{ year === null ? '' : `, in ${year}` }}</h3>
        <button
          v-for="station in records.oldest"
          :key="station.id"
          type="button"
          class="hover:bg-elevated flex h-8 items-center justify-between gap-2 rounded-md px-2 text-left"
          @click="emit('station', station.id)">
          <span class="text-highlighted truncate text-sm">{{ station.name }}</span>
          <span class="text-muted flex-none text-xs tabular-nums">since {{ station.year }}</span>
        </button>
      </section>

      <section class="flex flex-col gap-1">
        <h3 class="eyebrow text-muted px-2 pb-1">Most lines</h3>
        <button
          v-for="station in records.busiest"
          :key="station.id"
          type="button"
          class="hover:bg-elevated flex h-8 items-center gap-2 rounded-md px-2 text-left"
          @click="emit('station', station.id)">
          <span class="text-highlighted min-w-0 flex-1 truncate text-sm">{{ station.name }}</span>
          <span class="flex flex-none items-center gap-0.5">
            <span v-for="line in station.lines" :key="line.id" class="size-2 rounded-full" :style="{ background: line.color }" :title="line.name" />
          </span>
          <span class="text-muted w-4 flex-none text-right text-xs tabular-nums">{{ station.lines.length }}</span>
        </button>
      </section>

      <section class="flex flex-col gap-1">
        <h3 class="eyebrow text-muted px-2 pb-1">Longest lines</h3>
        <button
          v-for="line in records.longest"
          :key="line.id"
          type="button"
          class="hover:bg-elevated flex h-8 items-center gap-2.5 rounded-md px-2 text-left"
          @click="emit('line', line.id)">
          <span class="h-1.5 w-[22px] flex-none rounded-full" :style="{ background: line.color }" />
          <span class="text-highlighted min-w-0 flex-1 truncate text-sm">{{ line.name }}</span>
          <span class="text-muted flex-none text-xs tabular-nums">{{ formatMetric(line.km, 'km') }}</span>
        </button>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { NetworkGrowth, NetworkRecords } from '@railtime/renderer/transitMap.types';
  import { computed, ref } from 'vue';

  import type { GrowthMetric } from '~/features/explorer/insights/insights.types';
  import { formatMetric, growthSeries } from '~/features/explorer/insights/insights.utils';

  const METRICS: { label: string; value: GrowthMetric }[] = [
    { label: 'Stations', value: 'stations' },
    { label: 'Km', value: 'km' },
    { label: 'Lines', value: 'lines' },
  ];

  const props = defineProps<{
    /** The network year by year; `null` until the map is mounted. */
    growth: NetworkGrowth | null;
    /** Its records on the date shown. */
    records: NetworkRecords | null;
    /** The year shown on the map; `null` in a plan's future. */
    year: number | null;
  }>();
  const emit = defineEmits<{ year: [year: number]; station: [station: string]; line: [line: string] }>();

  const metric = ref<GrowthMetric>('stations');
  const points = computed(() => (props.growth ? growthSeries(props.growth.years, metric.value) : []));
</script>

<style>
  /* Unovis reads its colours from these: the site's tokens, so the charts follow the theme. */
  .insight-chart {
    --vis-font-family: var(--font-sans);
    --vis-axis-tick-label-color: var(--ui-text-muted);
    --vis-axis-tick-label-font-size: 11px;
    --vis-axis-grid-color: var(--ui-border);
    --vis-axis-domain-color: var(--ui-border);
    --vis-crosshair-line-stroke-color: var(--ui-text-dimmed);
    --vis-crosshair-circle-stroke-color: var(--ui-bg);
    --vis-tooltip-background-color: var(--ui-bg);
    --vis-tooltip-border-color: var(--ui-border);
    --vis-tooltip-text-color: var(--ui-text-highlighted);
    --vis-tooltip-padding: 6px 8px;
    --vis-tooltip-border-radius: 6px;
    --vis-tooltip-font-size: 12px;
  }

  .insight-chart-muted {
    color: var(--ui-text-muted);
  }
</style>
