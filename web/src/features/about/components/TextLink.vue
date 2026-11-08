<template>
  <ULink :to target="_blank" class="text-primary hover:underline"><slot /></ULink>
</template>

<script setup lang="ts">
  defineProps<{
    /** Where it goes, outside the site. */
    to: string;
  }>();

  defineSlots<{
    /** Its words. */
    default: () => unknown;
  }>();
</script>
