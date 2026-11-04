<template>
  <!-- One card, the same shape playing or not: the date and what it says; under them play between the steps back and on, where it always is, and the timeline, whose ends go back to today and to the plan built. -->
  <div class="map-card flex w-full flex-col p-3" :class="phone ? 'gap-1' : 'gap-2'">
    <div class="flex items-center" :class="phone ? 'gap-2' : 'gap-3'">
      <p class="text-highlighted flex-none font-extrabold tracking-[-0.02em] tabular-nums" :class="phone ? 'text-xl leading-6' : 'text-[28px] leading-8'">
        {{ yearText }}
      </p>
      <span v-if="step && mode === 'playing'" class="w-[3px] flex-none self-stretch rounded-full" :style="{ background: lineColor(step.color) }" />
      <div class="min-w-0 flex-1">
        <p class="truncate tabular-nums" :class="headline.strong ? 'text-highlighted text-sm font-bold' : 'text-muted text-sm'">{{ headline.text }}</p>
        <p v-if="headline.detail && !phone" class="text-muted truncate text-xs tabular-nums">{{ headline.detail }}</p>
      </div>
      <PlayerSettings :settings :phone @change="emit('settings', $event)" />
    </div>
    <div class="flex items-center" :class="phone ? 'gap-2' : 'gap-3'">
      <div class="flex flex-none items-center gap-1">
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
        <UTooltip :text="playing ? 'Pause' : playLabel" :kbds="['space']">
          <UButton
            :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
            class="flex-none justify-center rounded-full"
            :class="phone ? 'size-9' : 'size-10'"
            :aria-label="playing ? 'Pause' : playLabel"
            @click="playing ? emit('pause') : emit('play')" />
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
      <TimelineBar
        v-if="hasTimeline"
        class="min-w-0 flex-1"
        :changes
        :range
        :time
        label="Show the network on a date"
        :playing="mode === 'playing'"
        :planName="plan?.name"
        @pick="emit('pick', $event)"
        @leave="emit('leave', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo, StepInfo } from '@railtime/network/facts.types';
  import type { TimeState } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import type { PlayerSettings, TimeMode } from '~/features/explorer/explorer.types';
  import { yearOf } from '@railtime/core/date.utils';
  import { lineColor } from '~/utils/format.utils';
  import { formatDay, formatStats } from '~/features/explorer/format.utils';
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
    /** The plan shown, if any: its name, what became of it, and what it adds. */
    plan?: { name: string; status: string; facts: string };
    /** A network never built: no history, only its plan to play. */
    planOnly: boolean;
  }>();
  const emit = defineEmits<{
    play: [];
    pause: [];
    previous: [];
    skip: [];
    leave: [place: 'today' | 'end'];
    pick: [target: TimelineTarget];
    settings: [change: Partial<PlayerSettings>];
  }>();

  const playing = computed(() => props.mode === 'playing' && (props.time?.playing ?? false));
  const inPlan = computed(() => props.time?.inPlan === true);
  const atToday = computed(() => !props.time || props.time.atToday);
  // A network never built has no dates to slide through: it plays its plan, and steps through it.
  const hasTimeline = computed(() => !props.planOnly);

  const playLabel = computed(() => {
    return props.planOnly || (props.plan && (atToday.value || inPlan.value)) ? 'Play the plan' : 'Play';
  });

  const yearText = computed(() => {
    if (inPlan.value) return 'Plan';
    if (atToday.value) return 'Today';
    return props.time ? String(yearOf(props.time.time)) : '';
  });

  /** What the card says: the change playing, its line and day; else what the map shows, counted. */
  const headline = computed<{ text: string; detail?: string; strong: boolean }>(() => {
    const step = props.step;
    if (props.mode === 'playing' && step) {
      const day = step.time === null ? (props.plan?.name ?? 'Plan') : formatDay(step.time);
      return { text: step.title, detail: step.subtitle ? `${step.subtitle} · ${day}` : day, strong: true };
    }
    if (props.plan && inPlan.value) return { text: `${props.plan.name} built`, detail: `${props.plan.status} · ${props.plan.facts}`, strong: true };
    return { text: props.time ? formatStats(props.time.stats, props.phone) : '', strong: false };
  });
</script>
