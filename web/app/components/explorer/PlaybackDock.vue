<template>
  <div class="flex flex-wrap items-center gap-x-3.5 gap-y-2">
    <div class="flex flex-none gap-2">
      <UButton
        :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
        :aria-label="playing ? 'Pause' : 'Play'"
        size="lg"
        square
        @click="playing ? emit('pause') : emit('play')" />
      <UTooltip text="Next change">
        <UButton icon="i-lucide-skip-forward" color="neutral" variant="outline" size="lg" square aria-label="Next change" @click="emit('skip')" />
      </UTooltip>
    </div>
    <TimelineBar
      class="min-w-[220px] flex-[1_1_300px] max-sm:order-last max-sm:basis-full"
      :changes
      :range
      :time
      label="Timeline"
      @pick="emit('pick', $event)" />
    <div class="flex flex-none flex-wrap items-center gap-2">
      <SegmentedControl :modelValue="speed" :items="SPEED_OPTIONS" label="Speed" @update:modelValue="emit('speed', $event)" />
      <SegmentedControl :modelValue="camera" :items="CAMERA_OPTIONS" label="Camera" class="max-sm:hidden" @update:modelValue="emit('camera', $event)" />
      <!-- On a phone the icon alone, so the controls keep to one row. -->
      <UButton icon="i-lucide-x" color="neutral" variant="outline" size="lg" class="font-semibold" aria-label="Exit" @click="emit('exit')">
        <span class="max-sm:hidden">Exit</span>
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { CameraMode, ChangeInfo, TimeState } from '@railtime/renderer/transitMap.types';

  import { CAMERA_OPTIONS, SPEED_OPTIONS } from '~/utils/explorer.constants';
  import type { TimelineTarget } from '~/utils/timeline.types';

  import SegmentedControl from './SegmentedControl.vue';
  import TimelineBar from './TimelineBar.vue';

  defineProps<{
    time: TimeState | null;
    changes: ChangeInfo[];
    range: { start: number; end: number };
    playing: boolean;
    speed: number;
    camera: CameraMode;
  }>();
  const emit = defineEmits<{
    play: [];
    pause: [];
    skip: [];
    pick: [target: TimelineTarget];
    speed: [speed: number];
    camera: [mode: CameraMode];
    exit: [];
  }>();
</script>
