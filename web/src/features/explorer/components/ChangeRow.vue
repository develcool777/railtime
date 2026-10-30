<template>
  <button
    type="button"
    class="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-[background-color,opacity] duration-150"
    :class="[current ? 'bg-selected ring-selected' : 'hover:bg-elevated', { 'opacity-50': past }]"
    :aria-current="current || undefined"
    @click="emit('select', change.index)">
    <span class="text-muted w-10 flex-none text-xs leading-5 font-semibold tabular-nums">{{ change.time === null ? 'Plan' : yearOf(change.time) }}</span>
    <!-- Filled for an opening, hollow for a plan's, grey and hollow for a closure. -->
    <span class="mt-[5px] size-2.5 flex-none rounded-full border-2" :style="dotStyle" />
    <span class="min-w-0 flex-1">
      <span class="text-highlighted block text-sm leading-5 font-medium">{{ change.title }}</span>
      <span v-if="change.subtitle" class="text-muted block truncate text-xs leading-4">{{ change.subtitle }}</span>
    </span>
  </button>
</template>

<script setup lang="ts">
  import type { ChangeInfo } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import { yearOf } from '~/features/explorer/format.utils';

  const props = defineProps<{
    change: ChangeInfo;
    /** The change the map is at. */
    current?: boolean;
    /** Played already, while history plays. */
    past?: boolean;
  }>();
  const emit = defineEmits<{ select: [index: number] }>();

  const dotStyle = computed(() => {
    const closure = props.change.kind === 'close' || props.change.kind === 'stationClose';
    if (closure) return { borderColor: 'var(--ui-text-dimmed)' };
    if (props.change.time === null) return { borderColor: props.change.color };
    return { borderColor: props.change.color, background: props.change.color };
  });
</script>
