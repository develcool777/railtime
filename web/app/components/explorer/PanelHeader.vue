<template>
  <div class="border-muted flex items-center gap-2 border-b px-4 py-3.5">
    <UTooltip text="All cities">
      <UButton to="/" icon="i-lucide-layout-grid" color="neutral" variant="outline" size="lg" square aria-label="All cities" />
    </UTooltip>
    <USelectMenu
      :modelValue="city"
      :items="CITY_MENU"
      valueKey="value"
      icon="i-lucide-map-pin"
      size="lg"
      class="min-w-0 flex-1 font-semibold"
      :ui="{ leadingIcon: 'text-primary' }"
      :searchInput="{ placeholder: 'Find a city' }"
      aria-label="City"
      @update:modelValue="emit('city', String($event))" />
    <UColorModeButton color="neutral" variant="outline" size="lg" />
  </div>
</template>

<script setup lang="ts">
  import { cityMenu } from '~/utils/city.utils';

  defineProps<{ city: string }>();
  const emit = defineEmits<{ city: [city: string] }>();

  const CITY_MENU = cityMenu();
</script>
