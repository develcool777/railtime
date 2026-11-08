<template>
  <section class="flex flex-col gap-3">
    <h2 class="text-highlighted text-xl font-bold">{{ title }}</h2>
    <slot />
  </section>
</template>

<script setup lang="ts">
  defineProps<{
    /** The section's heading. */
    title: string;
  }>();

  defineSlots<{
    /** What it says. */
    default: () => unknown;
  }>();
</script>
