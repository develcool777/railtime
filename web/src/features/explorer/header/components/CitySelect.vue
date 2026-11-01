<template>
  <USelectMenu
    v-model:open="open"
    :modelValue="city"
    :items="CITY_MENU"
    valueKey="value"
    variant="ghost"
    color="neutral"
    icon="i-lucide-map-pin"
    trailingIcon="i-lucide-chevrons-up-down"
    class="text-highlighted hover:bg-elevated h-8 w-auto min-w-0 rounded-lg px-2 text-sm font-semibold"
    :ui="{
      content: 'max-h-[min(26rem,var(--reka-combobox-content-available-height,26rem))] w-72 rounded-lg shadow-[0_8px_30px_rgba(21,32,48,0.12)]',
      label: 'text-muted pt-2 text-xs font-medium',
      leadingIcon: 'text-muted size-4',
      trailingIcon: 'text-dimmed size-4',
    }"
    :content="{ align: 'start' }"
    :searchInput="{ placeholder: 'Find a city' }"
    aria-label="City"
    @update:modelValue="emit('city', String($event))">
    <template #item-trailing="{ item }">
      <span v-if="'lines' in item" class="text-dimmed text-xs tabular-nums">{{ item.lines }}</span>
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
  import { cityMenu, citySummaryOf } from '~/utils/city.utils';
  import { counted } from '~/utils/format.utils';

  defineProps<{ city: string }>();
  const emit = defineEmits<{ city: [city: string] }>();
  /** Whether its menu is open: Esc closes it before anything else on the page. */
  const open = defineModel<boolean>('open', { default: false });

  // Each city under its country: what its lines run as below its name, how many on the right.
  const CITY_MENU = cityMenu().map(group =>
    group.map(item => {
      if (!item.value) return item;
      const summary = citySummaryOf(item.value);
      return { ...item, description: summary.planOnly ? 'A plan, never built' : summary.networks.join(' · '), lines: counted(summary.lines, 'line') };
    }),
  );
</script>
