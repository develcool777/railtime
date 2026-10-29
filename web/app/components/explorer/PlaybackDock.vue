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
    <USlider
      class="min-w-[200px] flex-[1_1_300px]"
      :min="range.start"
      :max="range.end"
      :step="DAY_MS"
      :modelValue="time"
      aria-label="Timeline"
      @update:modelValue="onSlide" />
    <div class="flex flex-none flex-wrap items-center gap-2">
      <SegmentedControl :modelValue="speed" :items="SPEED_OPTIONS" label="Speed" @update:modelValue="emit('speed', $event)" />
      <SegmentedControl :modelValue="camera" :items="CAMERA_OPTIONS" label="Camera" class="max-sm:hidden" @update:modelValue="emit('camera', $event)" />
      <UButton icon="i-lucide-x" label="Exit" color="neutral" variant="outline" size="lg" class="font-semibold" @click="emit('exit')" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { CameraMode } from '@railtime/renderer/transitMap.types';

  import { CAMERA_OPTIONS, DAY_MS, SPEED_OPTIONS } from '~/utils/explorer.constants';

  import SegmentedControl from './SegmentedControl.vue';

  defineProps<{
    time: number;
    range: { start: number; end: number };
    playing: boolean;
    speed: number;
    camera: CameraMode;
  }>();
  const emit = defineEmits<{
    play: [];
    pause: [];
    skip: [];
    seek: [time: number];
    speed: [speed: number];
    camera: [mode: CameraMode];
    exit: [];
  }>();

  const onSlide = (value: number | number[] | undefined) => {
    if (typeof value === 'number') emit('seek', value);
  };
</script>
