<template>
  <div class="px-4 pb-6">
    <PanelSearch v-model="query" placeholder="Search changes" />
    <UEmpty v-if="changes.length === 0" icon="i-lucide-history" title="No changes yet" description="Nothing has opened or closed by the date shown." />
    <UEmpty v-else-if="rows.length === 0" icon="i-lucide-search-x" title="No change matches" description="Try a line, a station or a year." />
    <template v-else>
      <!-- The decade of the change at the top, under the search, over the list's own heading for it: no room of its own, and read once, from the list. -->
      <div class="sticky top-13 z-1 h-0" aria-hidden="true">
        <div class="eyebrow text-muted bg-default pt-1 pb-2">{{ topDecade }}</div>
      </div>
      <PanelList ref="list" label="Changes" :rows :estimate :covered="PANEL_SEARCH_HEIGHT">
        <template #row="{ row }">
          <h3 v-if="row.heading" class="eyebrow text-muted pt-1 pb-2">{{ row.decade }}</h3>
          <ChangeTimelineItem
            :change="row.change"
            :state="changeState(row.change.index, current)"
            :last="row.last"
            @select="emit('select', row.change.index)" />
        </template>
      </PanelList>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo } from '@railtime/network/facts.types';
  import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';

  import { CHANGE_ROW_ESTIMATE, DECADE_HEADING_ESTIMATE } from '~/features/explorer/changes/changes.constants';
  import type { ChangeRow } from '~/features/explorer/changes/changes.types';
  import { changeRows, changeState, changesByDecade, findChanges } from '~/features/explorer/changes/changes.utils';
  import { PANEL_SEARCH_HEIGHT } from '~/features/explorer/panel/panel.constants';

  const props = defineProps<{
    changes: ChangeInfo[];
    /** The change the map is at, by its position; none before the first. */
    current: number | null;
    /** History is playing: the change playing stays in the middle. */
    playing: boolean;
  }>();
  const emit = defineEmits<{ select: [index: number] }>();

  const list = useTemplateRef('list');
  const query = ref('');
  const rows = computed(() => changeRows(changesByDecade(findChanges(props.changes, query.value))));
  /** The decade of the row at the top, under the search. */
  const topDecade = computed(() => rows.value[list.value?.topRow ?? 0]?.decade);

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
   */
  const centreCurrent = (behavior: 'auto' | 'smooth') => {
    const index = rows.value.findIndex(row => row.change.index === props.current);
    if (index !== -1) list.value?.centre(index, behavior);
  };

  // Opens on the change shown; while playing, follows each as it starts.
  onMounted(async () => {
    await nextTick();
    centreCurrent('auto');
  });
  watch(
    () => props.current,
    async () => {
      if (!props.playing) return;
      await nextTick();
      centreCurrent('smooth');
    },
  );
</script>
