<template>
  <div class="px-4 pb-6">
    <PanelSearch v-model="query" placeholder="Search changes" />
    <UEmpty
      v-if="changes.length === 0"
      key="none"
      icon="i-lucide-history"
      title="No changes yet"
      description="Nothing has opened or closed by the date shown." />
    <UEmpty v-else-if="rows.length === 0" key="unmatched" icon="i-lucide-search-x" title="No change matches" description="Try a line, a station or a year." />
    <PanelList v-else ref="list" label="Changes" :rows :estimate :covered="PANEL_SEARCH_HEIGHT">
      <template #sticky="{ row }">
        <div class="eyebrow text-muted bg-default pt-1 pb-2">{{ row.decade }}</div>
      </template>
      <template #row="{ row }">
        <h3 v-if="row.heading" class="eyebrow text-muted pt-1 pb-2">{{ row.decade }}</h3>
        <ChangeTimelineItem :change="row.change" :state="changeState(row.change.index, current)" :last="row.last" @pick="emit('pick', row.change.index)" />
      </template>
    </PanelList>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo } from '@railtime/network/facts.types';
  import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';
  import { CHANGE_ROW_ESTIMATE, DECADE_HEADING_ESTIMATE } from '~/features/explorer/changes/changes.constants';
  import type { ChangeRow } from '~/features/explorer/changes/changes.types';
  import { changeRows, changeState, changesByDecade, findChanges } from '~/features/explorer/changes/changes.utils';
  import { PANEL_SEARCH_HEIGHT } from '~/features/explorer/panel/panel.constants';
  import type { PanelListHandle } from '~/features/explorer/panel/panel.types';

  const props = defineProps<{
    /** The changes up to the date shown, in order. */
    changes: ChangeInfo[];
    /** The change the map is at, by its position; none before the first. */
    current: number | null;
    /** History is playing: the change playing stays in the middle. */
    playing: boolean;
  }>();
  const emit = defineEmits<{ pick: [index: number] }>();

  const list = useTemplateRef<PanelListHandle>('list');
  const query = ref('');
  const rows = computed(() => changeRows(changesByDecade(findChanges(props.changes, query.value))));

  /**
   * How tall a row is likely to stand before it is measured.
   *
   * @param row - The row.
   * @returns Pixels.
   */
  const estimate = (row: ChangeRow) => CHANGE_ROW_ESTIMATE + (row.heading ? DECADE_HEADING_ESTIMATE : 0);

  /**
   * Brings the current change to the middle of the list.
   *
   * @param behavior - At once, or smoothly.
   * @returns Whether there was one to bring.
   */
  const centreCurrent = (behavior: 'auto' | 'smooth'): boolean => {
    const index = rows.value.findIndex(row => row.change.index === props.current);
    if (index !== -1) list.value?.centre(index, behavior);
    return index !== -1;
  };
  /** The list has opened on the change shown: on a page just opened, only once the map has said which it is. */
  let openedOnCurrent = false;

  // Opens on the change shown, as soon as there is one; while playing, follows each as it starts.
  onMounted(async () => {
    await nextTick();
    openedOnCurrent = centreCurrent('auto');
  });
  watch(
    () => props.current,
    async () => {
      if (!props.playing && openedOnCurrent) return;
      await nextTick();
      if (props.playing) centreCurrent('smooth');
      else openedOnCurrent = centreCurrent('auto');
    },
  );
</script>
