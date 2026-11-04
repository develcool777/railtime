<template>
  <!-- One item of Nuxt UI's timeline, standing alone so a long list builds only those in sight: its classes are the timeline's own, `app.config.ts`'s included; the room after it, the timeline's gap. -->
  <div :style="{ paddingBottom: last ? undefined : `${TIMELINE_GAP}px` }">
    <div data-slot="item" :class="classes.item()" :data-state="state">
      <div data-slot="container" :class="classes.container()">
        <!-- Filled for an opening, hollow for a plan's, grey and hollow for a closure. -->
        <UAvatar :size="TIMELINE_SIZE" data-slot="indicator" :class="classes.indicator()" :ui="{ icon: 'text-inherit', fallback: 'text-inherit' }">
          <span class="size-2.5 rounded-full border-2" :style="dotStyleOf(change)" />
        </UAvatar>
        <!-- The line on to the next change, none after the last. -->
        <div v-if="!last" data-slot="separator" aria-hidden="true" :class="classes.separator()" />
      </div>
      <!-- The whole change one button, so the pointer and the keyboard take all of it. -->
      <div data-slot="wrapper" :class="classes.wrapper()">
        <ListRow class="-mt-1 mb-2 flex-col items-start gap-0 px-2 py-1" @click="emit('select')">
          <span class="text-dimmed text-xs/5 tabular-nums">{{ change.time === null ? 'Plan' : yearOf(change.time) }}</span>
          <span class="text-highlighted text-sm leading-5 font-medium">{{ title ?? change.title }}</span>
          <span v-if="change.subtitle" class="text-muted text-sm leading-5">{{ change.subtitle }}</span>
        </ListRow>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { tv } from '@nuxt/ui/utils/tv';
  import { yearOf } from '@railtime/core/date.utils';
  import type { ChangeInfo } from '@railtime/network/facts.types';
  import { computed } from 'vue';
  import theme from '#build/ui/timeline';
  import { useAppConfig } from '#imports';
  import { TIMELINE_GAP, TIMELINE_SIZE } from '~/features/explorer/changes/changes.constants';
  import type { ChangeState } from '~/features/explorer/changes/changes.types';
  import { lineColor } from '~/utils/format.utils';

  defineProps<{
    change: ChangeInfo;
    /** Done, the current change, or still ahead (none). */
    state: ChangeState;
    /** The last of its run: no line on to the next. */
    last: boolean;
    /** A shorter title, where the context says the rest (a line's own view). */
    title?: string;
  }>();
  const emit = defineEmits<{ select: [] }>();

  const appConfig = useAppConfig();
  // As `UTimeline` makes them: its theme, extended by the app's.
  const classes = computed(() => tv({ extend: theme, ...appConfig.ui.timeline })({ orientation: 'vertical', size: TIMELINE_SIZE }));

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
