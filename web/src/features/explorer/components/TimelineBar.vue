<template>
  <div
    ref="bar"
    class="timeline relative h-[50px] cursor-pointer touch-none select-none"
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
    <!-- The plan's changes, after every date: their own zone at the right. -->
    <div
      v-if="scale.plannedCount > 0"
      class="border-accented absolute top-0 right-0 bottom-0 border-l border-dashed"
      :style="{ left: percent(1 - FUTURE_SHARE) }">
      <span class="eyebrow text-muted absolute top-0 left-1.5 text-[10px]">Future</span>
    </div>

    <span
      v-for="tick in ticks"
      :key="tick.index"
      class="tick absolute -translate-x-1/2 rounded-sm"
      :class="tick.closure ? 'bg-dimmed size-[3px]' : 'h-2 w-[3px]'"
      :style="{ left: percent(tick.left), bottom: `${32 + tick.level * 5}px`, background: tickColor(tick) }"
      :title="tick.label" />

    <div class="bg-accented absolute top-[24px] right-0 left-0 h-1 rounded-full" />
    <div class="bg-primary absolute top-[24px] left-0 h-1 rounded-full" :class="{ glide: playing }" :style="{ width: percent(thumb) }" />
    <div
      class="border-primary bg-default shadow-card absolute top-[19px] size-3.5 -translate-x-1/2 rounded-full border-[3px]"
      :class="{ glide: playing }"
      :style="{ left: percent(thumb) }" />

    <span
      v-for="entry in labels"
      :key="entry.text"
      class="absolute top-[33px] text-[11px] tabular-nums"
      :class="[entry.today ? 'text-highlighted font-semibold' : 'text-muted', labelAlign(entry.left)]"
      :style="{ left: percent(entry.left) }">
      {{ entry.text }}
    </span>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo, TimeState } from '@railtime/renderer/transitMap.types';
  import { computed, ref, useTemplateRef } from 'vue';

  import { FUTURE_SHARE } from '~/features/explorer/explorer.constants';
  import { yearOf } from '~/features/explorer/format.utils';
  import type { TimelineScale, TimelineTarget, TimelineTick } from '~/features/explorer/timeline.types';
  import { targetAt, thumbPosition, timelineLabels, timelineTicks } from '~/features/explorer/timeline.utils';

  const props = defineProps<{
    changes: ChangeInfo[];
    range: { start: number; end: number };
    time: TimeState | null;
    /** What it sets, for screen readers. */
    label: string;
    /** History is playing: the changes still to come are grey, and the thumb glides between them. */
    playing?: boolean;
  }>();
  const emit = defineEmits<{ pick: [target: TimelineTarget] }>();

  const bar = useTemplateRef<HTMLElement>('bar');
  const dragging = ref(false);

  const scale = computed<TimelineScale>(() => {
    const plannedCount = props.changes.filter(change => change.time === null).length;
    return { start: props.range.start, end: props.range.end, datedCount: props.changes.length - plannedCount, plannedCount };
  });
  const ticks = computed(() => timelineTicks(scale.value, props.changes));
  const labels = computed(() => timelineLabels(scale.value));
  const thumb = computed(() => {
    const now = props.time;
    return now ? thumbPosition(scale.value, now.time, now.cursor, now.future) : thumbPosition(scale.value, scale.value.end, 0, false);
  });
  const valueText = computed(() => {
    if (!props.time) return '';
    return props.time.future ? 'Future' : String(yearOf(props.time.time));
  });

  /** A tick's colour: its line's, but grey for a closure, or while playing for a change still to come. */
  const tickColor = (tick: TimelineTick): string | undefined => {
    if (tick.closure) return undefined;
    if (props.playing && props.time && tick.index >= props.time.cursor) return 'var(--ui-border-accented)';
    return tick.color;
  };

  const percent = (fraction: number): string => `${(fraction * 100).toFixed(3)}%`;

  /** The first label reads rightwards from its mark, the last leftwards; the rest are centred. */
  const labelAlign = (left: number): string => {
    if (left === 0) return '';
    return left >= 1 - FUTURE_SHARE - 0.001 ? '-translate-x-full' : '-translate-x-1/2';
  };

  /** Picks what the pointer is over. */
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

  /** Arrow keys step a year; Home and End go to the first date and the last. */
  const onKey = (event: KeyboardEvent) => {
    const now = props.time?.time ?? scale.value.end;
    const year = 365.25 * 864e5;
    const moves: Record<string, number> = { ArrowLeft: now - year, ArrowRight: now + year, Home: scale.value.start, End: scale.value.end };
    const next = moves[event.key];
    if (next === undefined) return;
    // The page's own arrow keys would step again.
    event.preventDefault();
    event.stopPropagation();
    emit('pick', { kind: 'date', time: Math.min(Math.max(next, scale.value.start), scale.value.end) });
  };
</script>

<style scoped>
  .glide {
    transition:
      left 0.4s,
      width 0.4s;
  }
</style>
