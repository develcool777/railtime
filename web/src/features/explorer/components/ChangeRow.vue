<template>
  <button
    type="button"
    class="hover:bg-elevated flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150"
    :class="{ 'opacity-60': upcoming, 'bg-elevated': current }"
    @click="emit('select', change.index)">
    <span class="text-muted w-11 flex-none pt-px text-[13px] font-semibold tabular-nums">{{ change.time === null ? 'Future' : yearOf(change.time) }}</span>
    <!-- Filled for an opening, hollow for a plan's, grey and hollow for a closure. -->
    <span class="mt-[5px] size-2.5 flex-none rounded-full border-2" :style="dotStyle" />
    <span class="min-w-0 flex-1">
      <span class="text-highlighted block text-sm leading-snug font-medium">{{ change.title }}</span>
      <span v-if="change.subtitle && !compact" class="text-muted block truncate text-xs">{{ change.subtitle }}</span>
    </span>
  </button>
</template>

<script setup lang="ts">
  import type { ChangeInfo } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import { yearOf } from '~/features/explorer/format.utils';

  const props = defineProps<{
    change: ChangeInfo;
    /** Not happened yet on the date shown. */
    upcoming?: boolean;
    /** Of the year shown. */
    current?: boolean;
    /** Title only, for a short list. */
    compact?: boolean;
  }>();
  const emit = defineEmits<{ select: [index: number] }>();

  const dotStyle = computed(() => {
    const closure = props.change.kind === 'close' || props.change.kind === 'stationClose';
    if (closure) return { borderColor: 'var(--ui-text-dimmed)' };
    if (props.change.time === null) return { borderColor: props.change.color };
    return { borderColor: props.change.color, background: props.change.color };
  });
</script>
