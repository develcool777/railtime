<template>
  <!-- A run of changes as a timeline: those the map has passed done, the current one active. -->
  <ul role="list">
    <li v-for="(change, position) in changes" :key="change.index">
      <ChangeTimelineItem
        :change
        :state="changeState(change.index, current ?? null)"
        :last="position === changes.length - 1"
        :title="titleOf?.(change)"
        @select="emit('select', change.index)" />
    </li>
  </ul>
</template>

<script setup lang="ts">
  import type { ChangeInfo } from '@railtime/network/facts.types';
  import { changeState } from '~/features/explorer/changes/changes.utils';

  defineProps<{
    /** The run of changes, in order. */
    changes: ChangeInfo[];
    /** The change the map is at, by its position in the whole timeline; none before the first. */
    current?: number | null;
    /** A shorter title for each, where the context says the rest (a line's own view). */
    titleOf?: (change: ChangeInfo) => string;
  }>();
  const emit = defineEmits<{ select: [index: number] }>();
</script>
