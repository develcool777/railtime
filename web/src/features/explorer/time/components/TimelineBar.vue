<template>
  <div class="relative h-[50px]">
    <div
      ref="bar"
      class="absolute inset-x-0 top-0 h-8 cursor-pointer touch-none select-none"
      role="slider"
      tabindex="0"
      :aria-label="label"
      :aria-valuemin="yearOf(scale.start)"
      :aria-valuemax="yearOf(scale.end)"
      :aria-valuenow="time ? yearOf(time.time) : undefined"
      :aria-valuetext="valueText"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="dragging = false"
      @pointercancel="dragging = false"
      @keydown="onKey">
      <span
        v-for="tick in ticks"
        :key="tick.index"
        class="tick absolute w-[3px] -translate-x-1/2 rounded-sm"
        :class="TICK_LOOK[tick.mark]"
        :style="{ left: percent(tick.left), bottom: `${14 + tick.level * 5}px`, background: tickColor(tick) }"
        :title="tick.label" />

      <div class="bg-accented absolute top-[24px] left-0 h-1 rounded-full" :style="{ width: percent(share) }" />
      <div class="bg-primary absolute top-[24px] left-0 h-1 rounded-full" :class="{ glide: playing }" :style="{ width: percent(Math.min(thumb, share)) }" />
      <!-- A plan's changes, after every date: their track dashed, as on the map. -->
      <template v-if="scale.plannedCount > 0">
        <div class="dashed absolute top-[24px] right-0 h-1 text-(--ui-border-accented)" :style="{ left: percent(share) }" />
        <div
          class="dashed text-primary absolute top-[24px] h-1"
          :class="{ glide: playing }"
          :style="{ left: percent(share), width: percent(Math.max(0, thumb - share)) }" />
      </template>
      <div
        class="border-primary bg-default shadow-card absolute top-[19px] size-3.5 -translate-x-1/2 rounded-full border-[3px]"
        :class="{ glide: playing }"
        :style="{ left: percent(thumb) }" />
    </div>

    <template v-for="(entry, position) in labels" :key="entry.text">
      <span
        v-if="!entry.place"
        class="text-muted absolute top-[33px] text-[11px] tabular-nums"
        :class="labelAlign(entry.left)"
        :style="{ left: percent(entry.left) }">
        {{ entry.text }}
      </span>
      <!-- Today and the plan built are places to go: the right end is where the map rests (H). -->
      <UTooltip
        v-else
        :text="entry.place === 'today' ? 'Back to today' : `${planName ?? 'The plan'}, built`"
        :kbds="position === labels.length - 1 ? ['H'] : undefined">
        <UButton
          :label="entry.text"
          color="neutral"
          variant="link"
          class="text-highlighted absolute top-[31px] p-0 text-[11px] font-semibold"
          :class="labelAlign(entry.left)"
          :style="{ left: percent(entry.left) }"
          @click="emit('leave', entry.place)" />
      </UTooltip>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { YEAR_MS, yearOf } from '@railtime/core/date.utils';
  import { clamp } from '@railtime/core/number.utils';
  import type { ChangeInfo } from '@railtime/network/facts.types';
  import type { TimeState } from '@railtime/renderer/transitMap.types';
  import { useElementSize } from '@vueuse/core';
  import { computed, ref, useTemplateRef } from 'vue';
  import { TICK_LOOK, TIMELINE_LABEL_GAP_PX } from '~/features/explorer/time/time.constants';
  import type { TimelineScale, TimelineTarget, TimelineTick } from '~/features/explorer/time/timeline.types';
  import { datedShare, targetAt, thumbPosition, timelineLabels, timelineTicks } from '~/features/explorer/time/timeline.utils';

  const props = defineProps<{
    /** The network's changes, in order: a mark each. */
    changes: ChangeInfo[];
    /** The timeline's first date and its end, as timestamps. */
    range: { start: number; end: number };
    /** Where the map is in its history, as it tells it; `null` until it does. */
    time: TimeState | null;
    /** What it sets, for screen readers. */
    label: string;
    /** History is playing: the changes still to come are grey, and the thumb glides between them. */
    playing?: boolean;
    /** The plan shown, by name, for its label's tooltip. */
    planName?: string;
  }>();
  const emit = defineEmits<{ pick: [target: TimelineTarget]; leave: [place: 'today' | 'end'] }>();

  const bar = useTemplateRef<HTMLElement>('bar');
  const dragging = ref(false);

  const scale = computed<TimelineScale>(() => {
    const plannedCount = props.changes.filter(change => change.time === null).length;
    return { start: props.range.start, end: props.range.end, datedCount: props.changes.length - plannedCount, plannedCount };
  });
  const ticks = computed(() => timelineTicks(scale.value, props.changes));
  const { width } = useElementSize(bar);
  const labels = computed(() => timelineLabels(scale.value, width.value > 0 ? TIMELINE_LABEL_GAP_PX / width.value : 0.1));
  const share = computed(() => datedShare(scale.value));
  const thumb = computed(() => {
    const now = props.time;
    return now ? thumbPosition(scale.value, now.time, now.cursor, now.inPlan) : thumbPosition(scale.value, scale.value.end, 0, false);
  });
  const valueText = computed(() => {
    if (!props.time) return '';
    return props.time.inPlan ? 'Plan' : String(yearOf(props.time.time));
  });

  /**
   * A tick's colour: its line's, and while playing grey for a change still to come.
   *
   * @param tick - The tick.
   * @returns Its colour, as CSS.
   */
  const tickColor = (tick: TimelineTick): string => {
    if (props.playing && props.time && tick.index >= props.time.cursor) return 'var(--ui-border-accented)';
    return tick.color;
  };

  const percent = (fraction: number): string => `${(fraction * 100).toFixed(3)}%`;

  /**
   * The first label reads rightwards from its mark; Today, at the end of the dates, and Plan leftwards; the rest are centred.
   *
   * @param left - Where its mark stands, as a share of the bar.
   * @returns Its classes.
   */
  const labelAlign = (left: number): string => {
    if (left === 0) return '';
    return left >= share.value - 0.001 ? '-translate-x-full' : '-translate-x-1/2';
  };

  /**
   * Picks what the pointer is over.
   *
   * @param clientX - The pointer, across the window.
   */
  const pickAt = (clientX: number) => {
    const rect = bar.value?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    emit('pick', targetAt(scale.value, (clientX - rect.left) / rect.width));
  };

  const onPointerDown = (event: PointerEvent) => {
    dragging.value = true;
    bar.value?.setPointerCapture(event.pointerId);
    pickAt(event.clientX);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (dragging.value) pickAt(event.clientX);
  };

  /**
   * Arrow keys step a year; Home and End go to the first date and the last.
   *
   * @param event - The key pressed.
   */
  const onKey = (event: KeyboardEvent) => {
    const now = props.time?.time ?? scale.value.end;
    const moves: Record<string, number> = { ArrowLeft: now - YEAR_MS, ArrowRight: now + YEAR_MS, Home: scale.value.start, End: scale.value.end };
    const next = moves[event.key];
    if (next === undefined) return;
    // The page's own arrow keys would step again.
    event.preventDefault();
    event.stopPropagation();
    emit('pick', { kind: 'date', time: clamp(next, scale.value.start, scale.value.end) });
  };
</script>

<style scoped>
  .glide {
    transition:
      left 0.4s,
      width 0.4s;
  }

  /* A plan's track, dashed as the map draws it, in the text colour set on it. */
  .dashed {
    background-image: repeating-linear-gradient(90deg, currentcolor 0 6px, transparent 6px 10px);
    background-clip: content-box;
    padding-left: 4px;
  }
</style>
