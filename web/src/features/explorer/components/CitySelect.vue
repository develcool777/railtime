<template>
  <USelectMenu
    :modelValue="city"
    :items="CITY_MENU"
    valueKey="value"
    icon="i-lucide-map-pin"
    class="w-52 font-semibold max-sm:w-40"
    :ui="{ leadingIcon: 'text-primary' }"
    :searchInput="{ placeholder: 'Find a city' }"
    aria-label="City"
    @update:modelValue="emit('city', String($event))" />
</template>

<script setup lang="ts">
  import { cityMenu } from '~/utils/city.utils';

  defineProps<{ city: string }>();
  const emit = defineEmits<{ city: [city: string] }>();

  const CITY_MENU = cityMenu();
</script>
