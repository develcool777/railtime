<template>
  <div ref="list" class="px-2 pt-2 pb-6">
    <p v-if="changes.length === 0" class="text-muted p-2 text-sm">No changes yet.</p>
    <ul role="list">
      <li v-for="change in changes" :key="change.index" :data-upcoming="isUpcoming(change) || undefined">
        <ChangeRow :change :upcoming="isUpcoming(change)" :current="isCurrent(change)" @select="emit('select', $event)" />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo, TimeState } from '@railtime/renderer/transitMap.types';
  import { nextTick, onMounted, useTemplateRef } from 'vue';

  import { yearOf } from '~/utils/format.utils';

  import ChangeRow from './ChangeRow.vue';

  const props = defineProps<{
    changes: ChangeInfo[];
    time: TimeState | null;
  }>();
  const emit = defineEmits<{ select: [index: number] }>();

  const list = useTemplateRef<HTMLElement>('list');

  // Opens on the date shown: the first change still to come, in the middle.
  onMounted(async () => {
    await nextTick();
    list.value?.querySelector('[data-upcoming]')?.scrollIntoView({ block: 'center' });
  });

  /** Not happened yet on the map shown. */
  const isUpcoming = (change: ChangeInfo): boolean => props.time !== null && change.index >= props.time.cursor;

  /** Of the year shown; nothing is, in a plan's future. */
  const isCurrent = (change: ChangeInfo): boolean =>
    props.time !== null && !props.time.future && change.time !== null && yearOf(change.time) === yearOf(props.time.time);
</script>
