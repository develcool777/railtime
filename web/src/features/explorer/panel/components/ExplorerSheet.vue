<template>
  <div class="flex-none">
    <!-- The handle: a tap steps through the snaps, a swipe up or down moves one. -->
    <UButton
      color="neutral"
      variant="ghost"
      class="h-5 w-full touch-none justify-center rounded-none p-0 hover:bg-transparent"
      :aria-label="`Sheet: ${snap}. Tap to resize`"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="startY = null">
      <span class="bg-accented h-[5px] w-10 rounded-full" />
    </UButton>
    <nav class="flex gap-1 px-2 pb-2" aria-label="Sections">
      <UButton
        v-for="section in sections"
        :key="section.id"
        color="neutral"
        variant="ghost"
        :active="section.id === open"
        activeColor="primary"
        activeVariant="soft"
        class="text-muted h-13 min-w-0 flex-1 flex-col justify-center gap-0.5 px-0"
        :aria-pressed="section.id === open"
        :aria-description="marks[section.id]"
        @click="emit('pick', section.id)">
        <UChip :show="!!marks[section.id]" size="md">
          <UIcon :name="section.icon" class="size-5" />
        </UChip>
        <span class="text-[11px] leading-4 font-semibold">{{ section.label }}</span>
      </UButton>
    </nav>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';

  import { SHEET_SNAPS, SHEET_SWIPE } from '~/features/explorer/explorer.constants';
  import type { Section, SheetSnap } from '~/features/explorer/explorer.types';

  defineProps<{
    sections: { id: Section; label: string; icon: string }[];
    /** The section shown; none while the sheet is down to its tabs. */
    open: Section | null;
    /** Sections whose choice is in force, a dot on each icon (Plans while a plan is shown), with what the dot says. */
    marks: Partial<Record<Section, string>>;
  }>();
  const emit = defineEmits<{ pick: [section: Section] }>();
  const snap = defineModel<SheetSnap>('snap', { required: true });

  /** Where a press on the handle began, to tell a tap from a swipe. */
  const startY = ref<number | null>(null);

  const onPointerDown = (event: PointerEvent) => {
    startY.value = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (startY.value === null) return;
    const moved = event.clientY - startY.value;
    startY.value = null;
    const place = SHEET_SNAPS.indexOf(snap.value);
    if (moved < -SHEET_SWIPE) snap.value = SHEET_SNAPS[Math.min(place + 1, SHEET_SNAPS.length - 1)] ?? snap.value;
    else if (moved > SHEET_SWIPE) snap.value = SHEET_SNAPS[Math.max(place - 1, 0)] ?? snap.value;
    else snap.value = SHEET_SNAPS[(place + 1) % SHEET_SNAPS.length] ?? snap.value;
  };
</script>
