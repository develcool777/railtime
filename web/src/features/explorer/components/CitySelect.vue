<template>
  <USelectMenu
    v-model:open="open"
    :modelValue="city"
    :items="CITY_MENU"
    valueKey="value"
    variant="ghost"
    color="neutral"
    class="text-highlighted hover:bg-elevated h-8 w-auto min-w-0 rounded-lg px-2 text-sm font-semibold"
    :ui="{ content: 'w-60 rounded-lg shadow-[0_8px_30px_rgba(21,32,48,0.12)]', item: 'h-8', label: 'eyebrow text-muted' }"
    :content="{ align: 'start' }"
    :searchInput="{ placeholder: 'Find a city' }"
    aria-label="City"
    @update:modelValue="emit('city', String($event))">
    <template #item-trailing="{ item }">
      <span v-if="'lines' in item" class="text-muted text-xs tabular-nums">{{ item.lines }}</span>
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
  import CITY_INDEX from '@railtime/data/cities.json';
  import type { CityIndex } from '@railtime/schema/cityIndex.types';

  import { cityMenu } from '~/utils/city.utils';

  defineProps<{ city: string }>();
  const emit = defineEmits<{ city: [city: string] }>();
  /** Whether its menu is open: Esc closes it before anything else on the page. */
  const open = defineModel<boolean>('open', { default: false });

  const INDEX: CityIndex = CITY_INDEX;
  // Each city with its line count on the right.
  const CITY_MENU = cityMenu().map(group => group.map(item => (item.value ? { ...item, lines: INDEX[item.value]?.lines ?? 0 } : item)));
</script>
