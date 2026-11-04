<template>
  <!-- What a station clicked on the map does, as the ringed field shows; what clears it, beside. -->
  <div class="flex min-h-6 items-center justify-between gap-2">
    <p class="text-dimmed flex min-w-0 items-center gap-1.5 text-xs">
      <UIcon name="i-lucide-mouse-pointer-click" class="size-3.5 flex-none" />
      <span class="truncate">{{ mapPickHint(end, picked) }}</span>
    </p>
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { mapPickHint } from '~/features/explorer/tools.utils';

  defineProps<{
    /** The end the map fills: a route's or a reach's start, or a route's end. */
    end: 'start' | 'end';
    /** It is picked already: a click changes it. */
    picked: boolean;
  }>();
  defineSlots<{
    /** Beside the hint: what clears the field. */
    default?: () => unknown;
  }>();
</script>
