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
      <!-- Where in the site: on a city's page, the site and then the city, whose menu picks another. -->
      <UBreadcrumb v-if="$slots.context" :items="[{ slot: 'home' }, { slot: 'context' }]" :ui="{ list: 'gap-1', separatorIcon: 'text-dimmed size-4' }">
        <template #home>
          <NuxtLink to="/" class="flex flex-none items-center gap-2" aria-label="RailLineage, all cities">
            <LogoMark class="size-6 flex-none" />
            <span class="text-highlighted text-lg leading-6 font-bold tracking-[-0.01em] max-lg:hidden">RailLineage</span>
          </NuxtLink>
        </template>
        <template #context>
          <slot name="context" />
        </template>
      </UBreadcrumb>
      <NuxtLink v-else to="/" class="flex flex-none items-center gap-2" aria-label="RailLineage, all cities">
        <LogoMark class="size-6 flex-none" />
        <span class="text-highlighted text-lg leading-6 font-bold tracking-[-0.01em]">RailLineage</span>
      </NuxtLink>
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
  defineSlots<{
    /** After the logo, where the page is: the city and its picker. */
    context?: () => unknown;
    /** The middle of the bar: the search's button. */
    center?: () => unknown;
    /** At the right, before the colour mode's button. */
    default?: () => unknown;
  }>();
</script>
