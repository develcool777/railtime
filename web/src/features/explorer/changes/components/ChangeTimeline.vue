<template>
  <!-- A run of changes as a timeline: those the map has reached done, the current one active. -->
  <UTimeline :modelValue="position" :items orientation="vertical" size="3xs" @select="(_event, item) => emit('select', item.value)">
    <!-- Filled for an opening, hollow for a plan's, grey and hollow for a closure. -->
    <template #indicator="{ item }">
      <span class="size-2.5 rounded-full border-2" :style="dotStyleOf(item.change)" />
    </template>
    <!-- The whole change one button, so the pointer and the keyboard take all of it; its click is the item's. -->
    <template #wrapper="{ item }">
      <ListRow class="-mt-1 mb-2 flex-col items-start gap-0 px-2 py-1">
        <span class="text-dimmed text-xs/5 tabular-nums">{{ item.date }}</span>
        <span class="text-highlighted text-sm leading-5 font-medium">{{ item.title }}</span>
        <span v-if="item.description" class="text-muted text-sm leading-5">{{ item.description }}</span>
      </ListRow>
    </template>
  </UTimeline>
</template>

<script setup lang="ts">
  import type { ChangeInfo } from '@railtime/network/facts.types';
  import { computed } from 'vue';

  import { timelinePosition } from '~/features/explorer/changes/changes.utils';
  import { lineColor, yearOf } from '~/features/explorer/format.utils';

  const props = defineProps<{
    /** The run of changes, in order. */
    changes: ChangeInfo[];
    /** The change the map is at, by its position in the whole timeline; none before the first. */
    current?: number | null;
    /** A shorter title for each, where the context says the rest (a line's own view). */
    titleOf?: (change: ChangeInfo) => string;
  }>();
  const emit = defineEmits<{ select: [index: number] }>();

  const items = computed(() =>
    props.changes.map(change => ({
      value: change.index,
      change,
      date: change.time === null ? 'Plan' : String(yearOf(change.time)),
      title: props.titleOf?.(change) ?? change.title,
      description: change.subtitle,
    })),
  );
  const position = computed(() =>
    timelinePosition(
      props.changes.map(change => change.index),
      props.current ?? null,
    ),
  );

  /**
   * A change's dot: filled in its line's colour for an opening, hollow for a plan's, grey for a closure.
   *
   * @param change - The change.
   * @returns The dot's colours.
   */
  const dotStyleOf = (change: ChangeInfo) => {
    if (change.kind === 'close' || change.kind === 'stationClose') return { borderColor: 'var(--ui-text-dimmed)' };
    const color = lineColor(change.color);
    if (change.time === null) return { borderColor: color };
    return { borderColor: color, background: color };
  };
</script>
