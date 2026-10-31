<template>
  <div ref="list" class="px-4 pb-6">
    <p v-if="changes.length === 0" class="text-muted p-4 text-sm">No changes yet.</p>
    <section v-for="group in groups" :key="group.decade">
      <h3 class="eyebrow text-muted bg-default sticky top-0 z-1 pt-3 pb-2">{{ group.decade }}</h3>
      <ChangeTimeline :changes="group.changes" :current @select="emit('select', $event)" />
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo } from '@railtime/renderer/transitMap.types';
  import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue';

  import { changesByDecade } from '~/features/explorer/changes/changes.utils';

  const props = defineProps<{
    changes: ChangeInfo[];
    /** The change the map is at, by its position; none before the first. */
    current: number | null;
    /** History is playing: the change playing stays in the middle. */
    playing: boolean;
  }>();
  const emit = defineEmits<{ select: [index: number] }>();

  const list = useTemplateRef<HTMLElement>('list');
  const groups = computed(() => changesByDecade(props.changes));

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
