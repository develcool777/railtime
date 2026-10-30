<template>
  <div class="flex-none">
    <!-- The handle: a tap steps through the snaps, a swipe up or down moves one. -->
    <button
      type="button"
      class="flex h-5 w-full touch-none items-center justify-center"
      :aria-label="`Sheet: ${snap}. Tap to resize`"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="startY = null">
      <span class="bg-accented h-[5px] w-10 rounded-full" />
    </button>
    <nav class="flex gap-1 px-2 pb-2" aria-label="Sections">
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        class="flex h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors duration-150"
        :class="section.id === open ? 'bg-selected text-selected' : 'text-muted'"
        :aria-pressed="section.id === open"
        :aria-description="section.id === marked ? markNote : undefined"
        @click="emit('pick', section.id)">
        <span class="relative">
          <UIcon :name="section.icon" class="size-5" />
          <span v-if="section.id === marked" class="bg-primary ring-default absolute -top-0.5 -right-1 size-2 rounded-full ring-2" />
        </span>
        <span class="text-[11px] leading-4 font-semibold">{{ section.label }}</span>
      </button>
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
    /** A section whose choice is in force, a dot on its icon: Plans while a plan is shown. */
    marked?: Section | null;
    /** What the dot means, for a screen reader. */
    markNote?: string;
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
