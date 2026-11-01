<template>
  <!-- Kept at the top of the panel as its list scrolls under it; a list's sticky headings sit below it (top-13). -->
  <div class="bg-default sticky top-0 z-2 -mx-4 flex h-13 flex-none items-center px-4">
    <UInput v-model="query" icon="i-lucide-search" :placeholder variant="soft" class="w-full" :aria-label="placeholder" />
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    /** What it searches: "Search stations". */
    placeholder: string;
  }>();

  /** What was typed. */
  const query = defineModel<string>({ required: true });
</script>
