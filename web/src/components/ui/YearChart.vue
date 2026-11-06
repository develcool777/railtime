<template>
  <!-- A click picks the year under the crosshair. -->
  <UChart
    :definition
    :categories="[{ key: 'value', label, color: 'primary' }]"
    :height
    :ariaLabel="summary"
    class="cursor-pointer"
    @select="point => point && emit('pick', point.datum.x)">
    <template #tooltip="{ title, primaryPoint }">
      <p class="font-medium">{{ title }}</p>
      <p class="flex justify-between gap-3">
        <span class="text-muted">{{ label }}</span>
        <span class="font-medium">{{ format(primaryPoint.datum.value) }}</span>
      </p>
    </template>
  </UChart>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { YearPoint } from '~/utils/yearChart.types';
  import { yearChartOf } from '~/utils/yearChart.utils';

  const props = defineProps<{
    /** The measure, year by year. */
    points: YearPoint[];
    /** What it is called, in the readout. */
    label: string;
    /** How a value of it is written in the readout. */
    format: (value: number) => string;
    /** How its axis writes a value; as the readout does if not given. */
    axisFormat?: (value: number) => string;
    /** How tall it is, pixels. */
    height: number;
    /** What it comes to, read out for it. */
    summary: string;
  }>();

  const emit = defineEmits<{ pick: [year: number] }>();

  const definition = computed(() => yearChartOf({ points: props.points, label: props.label, format: props.format, axisFormat: props.axisFormat }));
</script>
