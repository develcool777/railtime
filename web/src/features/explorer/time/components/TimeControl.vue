<template>
  <!-- One card, the same shape playing or not: play where it always is, the date, what it says, the ways back; under them the changes and the timeline. -->
  <div class="map-card flex w-full flex-col p-3" :class="phone ? 'gap-1' : 'gap-2'">
    <div class="flex items-center" :class="phone ? 'gap-2' : 'gap-3'">
      <UTooltip :text="playing ? 'Pause' : playLabel" :kbds="['space']">
        <UButton
          :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
          class="flex-none justify-center rounded-full"
          :class="phone ? 'size-9' : 'size-10'"
          :aria-label="playing ? 'Pause' : playLabel"
          @click="playing ? emit('pause') : emit('play')" />
      </UTooltip>
      <p class="text-highlighted flex-none font-extrabold tracking-[-0.02em] tabular-nums" :class="phone ? 'text-xl leading-6' : 'text-[28px] leading-8'">
        {{ yearText }}
      </p>
      <span v-if="step && mode === 'playing'" class="w-[3px] flex-none self-stretch rounded-full" :style="{ background: lineColor(step.color) }" />
      <div class="min-w-0 flex-1">
        <p class="truncate tabular-nums" :class="headline.strong ? 'text-highlighted text-sm font-bold' : 'text-muted text-sm'">{{ headline.text }}</p>
        <p v-if="headline.detail && !phone" class="text-muted truncate text-xs tabular-nums">{{ headline.detail }}</p>
      </div>
      <PlayerSettings :settings :phone @change="emit('settings', $event)" />
      <UTooltip v-if="!atToday && hasHistory" text="Back to today" :kbds="plan ? undefined : ['H']">
        <UButton label="Today" color="neutral" variant="outline" class="h-8 flex-none font-semibold" @click="emit('today')" />
      </UTooltip>
      <UTooltip v-if="plan && !isFuture" :text="`${plan.name}, built`" :kbds="['H']">
        <UButton :label="phone ? 'Plan' : 'Plan built'" color="neutral" variant="outline" class="h-8 flex-none font-semibold" @click="emit('future')" />
      </UTooltip>
    </div>
    <div v-if="hasTimeline" class="flex items-center" :class="phone ? 'gap-2' : 'gap-3'">
      <div class="flex flex-none gap-1" :class="phone ? 'w-auto' : 'w-10 justify-center'">
        <UTooltip text="Previous change" :kbds="playing ? ['←'] : undefined">
          <UButton
            icon="i-lucide-skip-back"
            color="neutral"
            variant="ghost"
            square
            class="size-7 justify-center rounded-full"
            aria-label="Previous change"
            @click="emit('previous')" />
        </UTooltip>
        <UTooltip text="Next change" :kbds="playing ? ['→'] : undefined">
          <UButton
            icon="i-lucide-skip-forward"
            color="neutral"
            variant="ghost"
            square
            class="size-7 justify-center rounded-full"
            aria-label="Next change"
            @click="emit('skip')" />
        </UTooltip>
      </div>
      <TimelineBar class="min-w-0 flex-1" :changes :range :time label="Show the network on a date" :playing="mode === 'playing'" @pick="emit('pick', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo, StepInfo } from '@railtime/network/facts.types';
  import type { TimeState } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import type { PlayerSettings, TimeMode } from '~/features/explorer/explorer.types';
  import { yearOf } from '@railtime/core/date.utils';
  import { formatDay, formatStats, lineColor } from '~/features/explorer/format.utils';
  import type { TimelineTarget } from '~/features/explorer/time/timeline.types';

  const props = defineProps<{
    mode: TimeMode;
    /** On a phone: smaller, the change's title without its details. */
    phone: boolean;
    time: TimeState | null;
    changes: ChangeInfo[];
    range: { start: number; end: number; today: number };
    /** The change playing now, for the caption. */
    step: StepInfo | null;
    /** How playback is set: its speed, camera and minimap. */
    settings: PlayerSettings;
    /** The plan shown, if any: its name, and what it adds. */
    plan?: { name: string; facts: string };
    /** A network never built: no history, only its plan to play. */
    planOnly: boolean;
  }>();
  const emit = defineEmits<{
    play: [];
    pause: [];
    previous: [];
    skip: [];
    today: [];
    future: [];
    pick: [target: TimelineTarget];
    settings: [change: Partial<PlayerSettings>];
  }>();

  const playing = computed(() => props.mode === 'playing' && (props.time?.playing ?? false));
  const isFuture = computed(() => props.time?.future === true);
  const atToday = computed(() => !props.time || (props.time.cursor === props.time.todayCursor && !isFuture.value));
  const hasHistory = computed(() => !props.planOnly);
  // A network never built has no dates to slide through: it plays its plan, and steps through it.
  const hasTimeline = computed(() => !props.planOnly);

  const playLabel = computed(() => {
    if (props.planOnly) return 'Play the plan';
    return props.plan && (atToday.value || isFuture.value) ? 'Play the future' : 'Play';
  });

  const yearText = computed(() => {
    if (isFuture.value) return 'Future';
    if (atToday.value) return 'Today';
    return props.time ? String(yearOf(props.time.time)) : '';
  });

  /** What the card says: the change playing, its line and day; else what the map shows, counted. */
  const headline = computed<{ text: string; detail?: string; strong: boolean }>(() => {
    const step = props.step;
    if (props.mode === 'playing' && step) {
      const day = step.time === null ? 'Future' : formatDay(step.time);
      return { text: step.title, detail: step.subtitle ? `${step.subtitle} · ${day}` : day, strong: true };
    }
    if (props.plan && isFuture.value) return { text: `${props.plan.name} built`, detail: props.plan.facts, strong: true };
    return { text: props.time ? formatStats(props.time.stats, props.phone) : '', strong: false };
  });
</script>
