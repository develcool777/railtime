<template>
  <!-- A click on a decade shows the map at its end. -->
  <UChart
    type="bar"
    :data="bars"
    index="label"
    :categories="[{ key: 'stations', label: 'Stations opened', color: 'primary' }]"
    :format="formatNumber"
    :height="120"
    :ariaLabel="summary"
    class="cursor-pointer"
    @select="point => point && pick(String(point.datum.x))" />
</template>

<script setup lang="ts">
  import type { DecadeOpenings } from '@railtime/network/facts.types';
  import { computed } from 'vue';

  import { formatNumber } from '~/utils/format.utils';

  const props = defineProps<{
    /** How many stations first opened in each decade. */
    decades: DecadeOpenings[];
  }>();
  const emit = defineEmits<{ pick: [year: number] }>();

  const bars = computed(() => props.decades.map(entry => ({ label: `${entry.decade}s`, decade: entry.decade, stations: entry.stations })));

  const summary = computed(() => {
    const busiest = [...props.decades].sort((first, second) => second.stations - first.stations)[0];
    return busiest ? `Stations opened by decade; the most, ${busiest.stations}, in the ${busiest.decade}s` : '';
  });

  /** Shows the map at the end of the decade picked. */
  const pick = (label: string) => {
    const decade = bars.value.find(bar => bar.label === label)?.decade;
    if (decade !== undefined) emit('pick', decade + 9);
  };
</script>
