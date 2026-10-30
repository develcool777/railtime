<template>
  <p class="text-muted text-[11px] leading-snug">
    <template v-for="(credit, position) in credits" :key="credit.text">
      <span v-if="position > 0"> · </span>
      <a v-if="credit.url" :href="credit.url" target="_blank" rel="noopener" class="text-primary hover:underline">{{ credit.text }}</a>
      <template v-else>{{ credit.text }}</template>
    </template>
  </p>
</template>

<script setup lang="ts">
  import type { Credit } from '@railtime/renderer/transitMap.types';

  defineProps<{ credits: Credit[] }>();
</script>
