<template>
  <UHeader
    :toggle="false"
    :ui="{
      root: wide ? 'bg-default h-14 max-lg:h-13' : 'bg-default/95',
      container: wide ? 'grid max-w-none grid-cols-[1fr_minmax(0,420px)_1fr] px-4 sm:px-4 lg:px-4 max-lg:flex' : 'max-w-7xl px-8 max-sm:px-4',
      left: 'min-w-0',
      center: 'min-w-0 justify-center',
    }">
    <template #left>
      <NuxtLink to="/" class="flex flex-none items-center gap-2" aria-label="Railtime, all cities">
        <LogoMark class="size-6 flex-none" />
        <span class="text-highlighted text-lg leading-6 font-bold tracking-[-0.01em]" :class="{ 'max-lg:hidden': $slots.context }">railtime</span>
      </NuxtLink>
      <!-- Where in the site: on a city's page, the city. -->
      <template v-if="$slots.context">
        <span class="text-dimmed mx-1 text-lg max-lg:hidden" aria-hidden="true">/</span>
        <slot name="context" />
      </template>
    </template>

    <slot name="center" />

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
