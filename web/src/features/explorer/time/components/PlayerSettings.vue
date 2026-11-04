<template>
  <UPopover :content="{ align: 'end', side: 'top', sideOffset: 8 }">
    <UTooltip text="Player settings">
      <UButton
        icon="i-lucide-settings"
        color="neutral"
        variant="ghost"
        square
        class="size-8 flex-none justify-center rounded-full"
        aria-label="Player settings" />
    </UTooltip>

    <template #content>
      <div class="flex w-72 flex-col gap-4 p-4" role="group" aria-label="Player settings">
        <div class="flex flex-col gap-1.5">
          <p class="text-highlighted text-xs font-bold">Speed</p>
          <UTabs
            :modelValue="settings.speed"
            :items="SPEED_OPTIONS"
            :content="false"
            size="sm"
            aria-label="Speed"
            @update:modelValue="emit('settings', { speed: Number($event) })" />
        </div>

        <div class="flex flex-col gap-1.5">
          <p class="text-highlighted text-xs font-bold">Camera</p>
          <UTabs
            :modelValue="settings.camera"
            :items="CAMERA_OPTIONS"
            :content="false"
            size="sm"
            aria-label="Camera"
            @update:modelValue="emit('settings', { camera: $event as CameraMode })" />
          <p class="text-muted text-xs">{{ cameraDescription }}</p>
        </div>

        <USwitch
          v-if="!phone"
          :modelValue="settings.minimap"
          label="Minimap"
          description="The whole city, and where the camera is"
          @update:modelValue="emit('settings', { minimap: $event })" />
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
  import type { CameraMode } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';
  import type { PlayerSettings } from '~/features/explorer/explorer.types';
  import { CAMERA_OPTIONS, SPEED_OPTIONS } from '~/features/explorer/time/time.constants';

  const props = defineProps<{
    /** How playback is set: its speed, camera and minimap. */
    settings: PlayerSettings;
    /** On a phone: no minimap. */
    phone: boolean;
  }>();
  const emit = defineEmits<{ settings: [change: Partial<PlayerSettings>] }>();

  const cameraDescription = computed(() => CAMERA_OPTIONS.find(option => option.value === props.settings.camera)?.description ?? '');
</script>
