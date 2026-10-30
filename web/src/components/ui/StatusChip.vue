<template>
  <span class="status-chip inline-flex flex-none items-center rounded border px-[7px] py-0.5 text-[11px] leading-tight font-semibold" :class="tone">
    <slot />
  </span>
</template>

<script setup lang="ts">
  import type { ChipTone } from '~/components/ui/statusChip.types';

  defineProps<{ tone: ChipTone }>();
</script>

<style scoped>
  .status-chip.green {
    background: var(--rt-tag-bg);
    color: var(--rt-tag-text);
    border-color: var(--rt-tag-border);
  }
  .status-chip.blue {
    background: var(--rt-ind-bg);
    color: var(--rt-ind-text);
    border-color: var(--rt-ind-border);
  }
  .status-chip.amber {
    background: var(--rt-badge-bg);
    color: var(--rt-badge-text);
    border-color: var(--rt-badge-border);
  }
  .status-chip.neutral {
    background: var(--ui-bg-muted);
    color: var(--ui-text-muted);
    border-color: var(--ui-border);
  }
</style>
