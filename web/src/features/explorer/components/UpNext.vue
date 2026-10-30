<template>
  <section>
    <h3 class="eyebrow text-muted mb-1.5 px-2">Up next</h3>
    <ul v-if="next.length > 0" role="list">
      <li v-for="change in next" :key="change.index">
        <ChangeRow :change compact @select="emit('select', $event)" />
      </li>
    </ul>
    <p v-else class="text-muted px-2 text-sm">That's every change. Exit to explore the result.</p>
  </section>
</template>

<script setup lang="ts">
  import type { ChangeInfo } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import { UP_NEXT_COUNT } from '~/features/explorer/explorer.constants';

  const props = defineProps<{
    changes: ChangeInfo[];
    /** The first change not yet started. */
    from: number;
  }>();
  const emit = defineEmits<{ select: [index: number] }>();

  const next = computed(() => props.changes.slice(props.from, props.from + UP_NEXT_COUNT));
</script>
