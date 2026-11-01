<template>
  <div ref="list" class="px-4 pb-6">
    <PanelSearch v-model="query" placeholder="Search changes" />
    <UEmpty v-if="changes.length === 0" icon="i-lucide-history" title="No changes yet" description="Nothing has opened or closed by the date shown." />
    <UEmpty v-else-if="groups.length === 0" icon="i-lucide-search-x" title="No change matches" description="Try a line, a station or a year." />
    <section v-for="group in groups" :key="group.decade">
      <!-- Under the search, which stays at the top too. -->
      <h3 class="eyebrow text-muted bg-default sticky top-13 z-1 pt-1 pb-2">{{ group.decade }}</h3>
      <ChangeTimeline :changes="group.changes" :current @select="emit('select', $event)" />
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo } from '@railtime/network/facts.types';
  import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';

  import { changesByDecade, findChanges } from '~/features/explorer/changes/changes.utils';

  const props = defineProps<{
    changes: ChangeInfo[];
    /** The change the map is at, by its position; none before the first. */
    current: number | null;
    /** History is playing: the change playing stays in the middle. */
    playing: boolean;
  }>();
  const emit = defineEmits<{ select: [index: number] }>();

  const list = useTemplateRef<HTMLElement>('list');
  const query = ref('');
  const groups = computed(() => changesByDecade(findChanges(props.changes, query.value)));

  /** Brings the current change, the timeline's active item, to the middle of the list. */
  const centreCurrent = (behavior: 'instant' | 'smooth') => list.value?.querySelector('[data-state="active"]')?.scrollIntoView({ block: 'center', behavior });

  // Opens on the change shown; while playing, follows each as it starts.
  onMounted(async () => {
    await nextTick();
    centreCurrent('instant');
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
