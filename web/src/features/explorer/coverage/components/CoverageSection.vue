<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-6">
    <UEmpty
      v-if="state === 'missing'"
      icon="i-lucide-scan"
      title="No outline for this city yet"
      description="Coverage needs the city's limits, kept for a few cities so far." />
    <div v-else-if="!coverage" class="text-muted py-8 text-center text-sm">Loading the city's outline…</div>
    <template v-else>
      <div class="flex flex-col gap-2">
        <p class="text-highlighted text-2xl leading-8 font-bold tabular-nums">{{ formatShare(coverage.share) }}</p>
        <p class="text-muted text-sm">of {{ coverage.name }}'s area is within {{ coverage.metres }} m of a station, on the date shown</p>
        <!-- The bands side by side, each as wide as the share of the city in it, the rest of the city after them. -->
        <div class="bg-elevated flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
          <span v-for="band in coverage.bands" :key="band.upTo" :style="{ width: `${band.share * 100}%`, background: band.color }" />
        </div>
      </div>

      <ul class="flex flex-col" role="list">
        <li v-for="band in coverage.bands" :key="band.upTo">
          <ListRow :disabled="true">
            <span class="size-2.5 flex-none rounded-full" :style="{ background: band.color }" />
            <span class="text-highlighted flex-1 text-sm font-medium">{{ band.label }}</span>
            <span class="text-muted text-xs tabular-nums">{{ formatArea(band.km2) }}</span>
            <span class="text-default w-12 text-right text-xs font-medium tabular-nums">{{ formatShare(band.share) }}</span>
          </ListRow>
        </li>
        <li>
          <ListRow :disabled="true">
            <span class="bg-accented size-2.5 flex-none rounded-full" />
            <span class="text-highlighted flex-1 text-sm font-medium">Farther</span>
            <span class="text-muted text-xs tabular-nums">{{ formatArea(coverage.beyond.km2) }}</span>
            <span class="text-default w-12 text-right text-xs font-medium tabular-nums">{{ formatShare(coverage.beyond.share) }}</span>
          </ListRow>
        </li>
      </ul>

      <!-- A city nothing was ever built in has only a flat line at 0 to show. -->
      <div v-if="history.length > 1 && history.some(entry => entry.share > 0)" class="flex flex-col gap-1">
        <p class="text-highlighted text-sm font-medium">Within {{ coverage.metres }} m, year by year</p>
        <!-- A click picks the year under the crosshair. -->
        <UChart
          type="area"
          :data="points"
          index="year"
          :categories="[{ key: 'percent', label: 'Covered', color: 'primary' }]"
          :format="(value: number) => formatShare(value / 100)"
          :height="150"
          :ariaLabel="summary"
          class="cursor-pointer"
          @select="point => point && emit('year', Number(point.datum.x))" />
      </div>

      <p class="text-dimmed text-xs">
        Distances are as the crow flies from each station a line calls at. {{ formatArea(coverage.km2) }} inside the city's limits, parks, water and woods among
        them. Outline: {{ coverage.source }}.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { CoverageInfo, CoverageYear } from '@railtime/network/facts.types';
  import { computed } from 'vue';

  import type { BoundaryState } from '~/features/explorer/coverage/coverage.composable.types';
  import { formatArea, formatShare } from '~/features/explorer/coverage/coverage.utils';

  const props = defineProps<{
    /** Where the city's outline is. */
    state: BoundaryState;
    /** The coverage on the date shown, once the outline is in. */
    coverage: CoverageInfo | null;
    /** The covered share year by year. */
    history: CoverageYear[];
  }>();
  const emit = defineEmits<{ year: [year: number] }>();

  const points = computed(() => props.history.map(entry => ({ year: entry.year, percent: entry.share * 100 })));
  const summary = computed(() => {
    const first = props.history.find(entry => entry.share > 0);
    const last = props.history.at(-1);
    return first && last ? `From ${formatShare(first.share)} in ${first.year} to ${formatShare(last.share)} in ${last.year}` : '';
  });
</script>
