<template>
  <UHeader :toggle="false" :ui="{ root: 'bg-default/95', container: wide ? 'max-w-none px-4 sm:px-4 lg:px-4' : 'max-w-7xl px-8 max-sm:px-4' }">
    <template #left>
      <slot name="leading" />
      <NuxtLink to="/" class="flex items-center gap-2.5" aria-label="Railtime, all cities">
        <span class="flex gap-[3px]" aria-hidden="true">
          <span class="bg-brand-500 h-[18px] w-1.5 rounded-sm" />
          <span class="bg-brand-300 h-[18px] w-1.5 rounded-sm" />
        </span>
        <span class="text-highlighted text-lg font-extrabold tracking-tight">railtime</span>
      </NuxtLink>
      <!-- Where in the site: on a city's page, the city. -->
      <template v-if="$slots.context">
        <span class="text-dimmed mx-1 text-lg" aria-hidden="true">/</span>
        <slot name="context" />
      </template>
    </template>

    <template #right>
      <slot />
      <UColorModeButton color="neutral" variant="outline" />
    </template>
  </UHeader>
</template>

<script setup lang="ts">
  defineProps<{
    /** Across the whole window, as over a map; otherwise the page's column. */
    wide?: boolean;
  }>();
</script>
