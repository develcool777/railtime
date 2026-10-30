<template>
  <USelectMenu
    :modelValue="city"
    :items="CITY_MENU"
    valueKey="value"
    variant="ghost"
    size="lg"
    class="text-highlighted w-auto min-w-36 text-base font-bold max-sm:min-w-0"
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
