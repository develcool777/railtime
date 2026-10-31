<template>
  <div class="flex flex-col gap-6 px-4 pt-3 pb-6">
    <!-- A network never built has only plans: no years, no records worth reading. -->
    <UEmpty
      v-if="!growth || !hasHistory"
      icon="i-lucide-chart-no-axes-column"
      title="Never built"
      description="This metro exists only on paper, so it has no history to chart yet. See what was planned under Plans." />
    <template v-else>
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <h3 class="eyebrow text-muted">Growth</h3>
          <UTabs v-model="metric" :items="METRICS" :content="false" aria-label="What the chart measures" />
        </div>
        <GrowthChart :points :metric @pick="emit('year', $event)" />
        <p class="text-dimmed text-xs">Pick a year on the chart to see the map then.</p>
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="eyebrow text-muted">Stations opened, by decade</h3>
        <DecadeChart :decades="growth.decades" @pick="emit('year', $event)" />
      </section>

      <template v-if="records">
        <section class="flex flex-col gap-1">
          <h3 class="eyebrow text-muted px-2 pb-1">Open longest{{ year === null ? '' : `, in ${year}` }}</h3>
          <ListRow v-for="station in records.oldest" :key="station.id" @click="emit('station', station.id)">
            <span class="text-highlighted min-w-0 flex-1 truncate text-sm">{{ station.name }}</span>
            <span class="text-muted flex-none text-xs tabular-nums">since {{ station.year }}</span>
          </ListRow>
        </section>

        <section class="flex flex-col gap-1">
          <h3 class="eyebrow text-muted px-2 pb-1">Most lines</h3>
          <ListRow v-for="station in records.busiest" :key="station.id" @click="emit('station', station.id)">
            <span class="text-highlighted min-w-0 flex-1 truncate text-sm">{{ station.name }}</span>
            <span class="flex flex-none items-center gap-0.5">
              <span v-for="line in station.lines" :key="line.id" class="size-2 rounded-full" :style="{ background: line.color }" :title="line.name" />
            </span>
            <span class="text-muted w-4 flex-none text-right text-xs tabular-nums">{{ station.lines.length }}</span>
          </ListRow>
        </section>

        <section class="flex flex-col gap-1">
          <h3 class="eyebrow text-muted px-2 pb-1">Longest lines</h3>
          <ListRow v-for="line in records.longest" :key="line.id" @click="emit('line', line.id)">
            <span class="h-1.5 w-[22px] flex-none rounded-full" :style="{ background: line.color }" />
            <span class="text-highlighted min-w-0 flex-1 truncate text-sm">{{ line.name }}</span>
            <span class="text-muted flex-none text-xs tabular-nums">{{ formatMetric(line.km, 'km') }}</span>
          </ListRow>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { NetworkGrowth, NetworkRecords } from '@railtime/network/facts.types';
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
    /** Whether some year has a station on the map: one never built has only its plans. */
    hasHistory: boolean;
    /** Its records on the date shown. */
    records: NetworkRecords | null;
    /** The year shown on the map; `null` in a plan's future. */
    year: number | null;
  }>();
  const emit = defineEmits<{ year: [year: number]; station: [station: string]; line: [line: string] }>();

  const metric = ref<GrowthMetric>('stations');
  const points = computed(() => (props.growth ? growthSeries(props.growth.years, metric.value) : []));
</script>
