<template>
  <!-- A click picks the year under the crosshair. -->
  <UChart
    type="area"
    :data="points"
    index="year"
    :categories="[{ key: 'percent', label: 'Covered', color: 'primary' }]"
    :format="(value: number) => formatShare(value / 100)"
    :height
    :ariaLabel="summary"
    class="cursor-pointer"
    @select="point => point && emit('pick', Number(point.datum.x))" />
</template>

<script setup lang="ts">
  import type { CoverageYear } from '@railtime/network/facts.types';
  import { computed } from 'vue';
  import { formatShare } from '~/utils/format.utils';

  const props = defineProps<{
    /** The covered share year by year. */
    history: CoverageYear[];
    /** How tall it is, pixels. */
    height: number;
  }>();

  const emit = defineEmits<{ pick: [year: number] }>();

  const points = computed(() => props.history.map(entry => ({ year: entry.year, percent: entry.share * 100 })));
  const summary = computed(() => {
    const first = props.history.find(entry => entry.share > 0);
    const last = props.history.at(-1);
    return first && last ? `From ${formatShare(first.share)} in ${first.year} to ${formatShare(last.share)} in ${last.year}` : '';
  });
</script>
