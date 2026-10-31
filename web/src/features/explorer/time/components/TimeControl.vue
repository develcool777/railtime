<template>
  <!-- At rest: what the map shows today, and the way into its history. -->
  <div v-if="mode === 'rest'" class="map-card flex h-12 items-center gap-3 pr-1.5 pl-4">
    <p class="flex min-w-0 items-baseline gap-2 text-sm whitespace-nowrap">
      <span class="text-highlighted font-bold">{{ restLabel }}</span>
      <span v-if="restTotals" class="text-muted truncate tabular-nums">{{ phone ? '· ' : '' }}{{ restTotals }}</span>
    </p>
    <UTooltip :text="planOnly ? 'Play the plan' : 'History'" :kbds="planOnly ? ['space'] : ['H']">
      <UButton
        :icon="planOnly ? 'i-lucide-play' : 'i-lucide-history'"
        :label="phone ? undefined : planOnly ? 'Play the plan' : 'History'"
        :aria-label="planOnly ? 'Play the plan' : 'History'"
        color="neutral"
        variant="ghost"
        class="bg-selected text-selected ring-selected hover:bg-brand-100 dark:hover:bg-brand-900 h-9 flex-none rounded-lg font-semibold"
        @click="emit('open')" />
    </UTooltip>
  </div>

  <!-- The timeline: a date picked by dragging, clicking or the arrow keys. -->
  <div v-else-if="mode === 'timeline'" class="map-card flex w-full flex-col gap-1 p-3">
    <div class="flex items-center gap-3">
      <p class="text-highlighted text-[28px] leading-8 font-extrabold tracking-[-0.02em] tabular-nums">{{ yearText }}</p>
      <p class="text-muted min-w-0 flex-1 truncate text-sm tabular-nums">{{ totals }}</p>
      <UButton v-if="!isToday && hasHistory" label="Today" color="neutral" variant="outline" class="h-8 font-semibold" @click="emit('today')" />
      <UButton v-if="plan && !isFuture" label="Future" color="neutral" variant="outline" class="h-8 font-semibold" @click="emit('future')" />
      <UTooltip :text="plan ? 'Close, back to the plan' : 'Close, back to today'" :kbds="['H']">
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" square class="size-8" aria-label="Close the timeline" @click="emit('close')" />
      </UTooltip>
    </div>
    <div class="flex items-center gap-3">
      <UTooltip :text="plan ? 'Play the future' : 'Play history'" :kbds="['space']">
        <UButton
          icon="i-lucide-play"
          class="size-10 flex-none justify-center rounded-full"
          :aria-label="plan ? 'Play the future' : 'Play history'"
          @click="emit('play')" />
      </UTooltip>
      <TimelineBar class="min-w-0 flex-1" :changes :range :time label="Show the network on a date" @pick="emit('pick', $event)" />
    </div>
  </div>

  <!-- The player on a phone: one row, the caption on one line. -->
  <div v-else-if="phone" class="map-card flex h-14 w-full items-center gap-2.5 pr-2 pl-3">
    <p class="text-highlighted flex-none text-xl leading-6 font-extrabold tabular-nums">{{ yearText }}</p>
    <span class="h-6 w-[3px] flex-none rounded-full" :style="{ background: step?.color ?? 'var(--ui-border)' }" />
    <p class="text-highlighted min-w-0 flex-1 truncate text-xs font-semibold">{{ step?.title }}</p>
    <UButton
      :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
      class="size-9 flex-none justify-center rounded-full"
      :aria-label="playing ? 'Pause' : 'Play'"
      @click="playing ? emit('pause') : emit('play')" />
    <UButton
      icon="i-lucide-skip-forward"
      color="neutral"
      variant="outline"
      class="size-9 flex-none justify-center rounded-full"
      aria-label="Next change"
      @click="emit('skip')" />
    <PlayerSettings :settings :viewMode phone @change="emit('settings', $event)" @viewMode="emit('viewMode', $event)" />
    <UButton label="Exit" color="neutral" variant="ghost" class="flex-none font-semibold" @click="emit('exit')" />
  </div>

  <!-- The player: the change playing, its settings, and the timeline it runs along. -->
  <div v-else class="map-card flex w-full flex-col gap-2 p-3">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p class="text-highlighted flex-none text-4xl leading-10 font-extrabold tracking-[-0.02em] tabular-nums">{{ yearText }}</p>
      <span class="h-9 w-[3px] flex-none rounded-full" :style="{ background: step?.color ?? 'var(--ui-border)' }" />
      <div class="min-w-[200px] flex-1">
        <p class="text-highlighted truncate text-sm font-bold">{{ step?.title }}</p>
        <p class="text-muted truncate text-xs tabular-nums">{{ caption }}</p>
      </div>
      <PlayerSettings :settings :viewMode :phone="false" @change="emit('settings', $event)" @viewMode="emit('viewMode', $event)" />
      <UButton icon="i-lucide-x" label="Exit" color="neutral" variant="outline" class="h-9 font-semibold" @click="emit('exit')" />
    </div>
    <div class="flex items-center gap-3">
      <UTooltip text="Previous change" :kbds="['←']">
        <UButton
          icon="i-lucide-skip-back"
          color="neutral"
          variant="outline"
          class="size-9 flex-none justify-center rounded-full"
          aria-label="Previous change"
          @click="emit('previous')" />
      </UTooltip>
      <UTooltip :text="playing ? 'Pause' : 'Play'" :kbds="['space']">
        <UButton
          :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
          class="size-10 flex-none justify-center rounded-full"
          :aria-label="playing ? 'Pause' : 'Play'"
          @click="playing ? emit('pause') : emit('play')" />
      </UTooltip>
      <UTooltip text="Next change" :kbds="['→']">
        <UButton
          icon="i-lucide-skip-forward"
          color="neutral"
          variant="outline"
          class="size-9 flex-none justify-center rounded-full"
          aria-label="Next change"
          @click="emit('skip')" />
      </UTooltip>
      <TimelineBar class="min-w-0 flex-1" :changes :range :time label="Timeline" playing @pick="emit('pick', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo, StepInfo, TimeState, ViewMode } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import type { PlayerSettings, TimeMode } from '~/features/explorer/explorer.types';
  import { formatDay, formatStats, yearOf } from '~/features/explorer/format.utils';
  import type { TimelineTarget } from '~/features/explorer/time/timeline.types';

  const props = defineProps<{
    mode: TimeMode;
    /** On a phone: shorter totals, an icon-only History button, a one-row player. */
    phone: boolean;
    time: TimeState | null;
    changes: ChangeInfo[];
    range: { start: number; end: number; today: number };
    /** The change playing now, for the player's caption. */
    step: StepInfo | null;
    /** How playback is set: its speed, camera and minimap. */
    settings: PlayerSettings;
    /** How the map is seen: flat, or in 3D. */
    viewMode: ViewMode;
    /** The plan shown, if any: its name, and what it adds. */
    plan?: { name: string; facts: string };
    /** A network never built: no history, only its plan to play. */
    planOnly: boolean;
  }>();
  const emit = defineEmits<{
    open: [];
    close: [];
    today: [];
    future: [];
    play: [];
    pause: [];
    previous: [];
    skip: [];
    pick: [target: TimelineTarget];
    settings: [change: Partial<PlayerSettings>];
    viewMode: [mode: ViewMode];
    exit: [];
  }>();

  const playing = computed(() => props.time?.playing ?? false);
  const isFuture = computed(() => props.time?.future === true);
  const isToday = computed(() => !props.time || (props.time.cursor === props.time.todayCursor && !isFuture.value));
  const hasHistory = computed(() => !props.planOnly);

  const restLabel = computed(() => (props.plan ? `${props.plan.name} built` : 'Today'));
  const restTotals = computed(() => {
    if (props.plan) return props.plan.facts;
    return props.time ? formatStats(props.time.stats, props.phone) : '';
  });
  const totals = computed(() => (props.time ? formatStats(props.time.stats) : ''));

  const yearText = computed(() => {
    if (isFuture.value) return 'Future';
    if (props.mode === 'timeline' && isToday.value) return 'Today';
    return props.time ? String(yearOf(props.time.time)) : '';
  });

  /** "Arnos Grove – Cockfosters · 31 July 1933". */
  const caption = computed(() => {
    const step = props.step;
    if (!step) return '';
    const day = step.time === null ? 'Future' : formatDay(step.time);
    return step.subtitle ? `${step.subtitle} · ${day}` : day;
  });
</script>
