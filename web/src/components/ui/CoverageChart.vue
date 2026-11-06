<template>
  <YearChart :points label="Covered" :format :axisFormat :height :summary @pick="emit('pick', $event)" />
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

  /**
   * A percentage as the readout writes it.
   *
   * @param value - The percentage.
   * @returns "34%", "4.2%".
   */
  const format = (value: number): string => formatShare(value / 100);

  /**
   * A round percentage as the axis writes it: no decimal it does not need, where `formatShare` keeps one under 10.
   *
   * @param value - The percentage.
   * @returns "8%", "0.5%".
   */
  const axisFormat = (value: number): string => `${Number(value.toFixed(1))}%`;

  const points = computed(() => props.history.map(entry => ({ year: entry.year, value: entry.share * 100 })));
  const summary = computed(() => {
    const first = props.history.find(entry => entry.share > 0);
    const last = props.history.at(-1);
    return first && last ? `From ${formatShare(first.share)} in ${first.year} to ${formatShare(last.share)} in ${last.year}` : '';
  });
</script>
