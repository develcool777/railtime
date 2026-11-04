<template>
  <p class="text-muted text-[11px] leading-snug">
    <template v-for="(credit, position) in credits" :key="credit.text">
      <span v-if="position > 0"> · </span>
      <a v-if="credit.url" :href="credit.url" target="_blank" rel="noopener" class="text-primary hover:underline">{{ credit.text }}</a>
      <template v-else>{{ credit.text }}</template>
    </template>
    <!-- The rest of what the site owes, and to whom: the networks' sources, on the About page. -->
    <template v-if="about">
      <span> · </span>
      <NuxtLink to="/about" class="text-primary hover:underline">About</NuxtLink>
    </template>
  </p>
</template>

<script setup lang="ts">
  import type { Credit } from '@railtime/renderer/transitMap.types';

  defineProps<{
    /** What the map shows owes, each linked to its source where it has one. */
    credits: Credit[];
    /** Ends with a link to the About page, which credits the rest. */
    about?: boolean;
  }>();
</script>
