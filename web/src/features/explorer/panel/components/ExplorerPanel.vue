<template>
  <!-- On a phone: a drawer over the map's foot, always there, snapping to its tabs (named under their icons where the screen is wide enough), half the screen or all of it; dragged by its handle, so the lists in it scroll. -->
  <UDrawer
    v-if="phone"
    open
    :modal="false"
    :dismissible="false"
    :overlay="false"
    noBodyStyles
    handleOnly
    :snapPoints="Object.values(snapPoints)"
    :activeSnapPoint="snapPoints[snap]"
    title="Panel"
    description="The open section, with its tabs"
    :ui="{ content: 'mt-0 h-dvh max-h-none rounded-t-lg shadow-[0_-8px_30px_rgba(0,0,0,0.12)]', handle: 'mt-2' }"
    @update:activeSnapPoint="toSnap">
    <template #content>
      <nav class="flex flex-none gap-1 px-2 pt-1 pb-2" aria-label="Sections">
        <UButton
          v-for="tab in sections"
          :key="tab.id"
          color="neutral"
          variant="ghost"
          :active="tab.id === shown"
          activeColor="primary"
          activeVariant="soft"
          class="min-w-0 flex-1 flex-col justify-center gap-0.5 px-0"
          :class="[tabLabels ? 'h-13' : 'h-11', { 'text-muted': tab.id !== shown }]"
          :aria-label="tabLabels ? undefined : tab.label"
          :aria-pressed="tab.id === shown"
          :aria-description="marks[tab.id]"
          @click="emit('pick', tab.id)">
          <UChip :show="marks[tab.id] !== undefined" size="md">
            <UIcon :name="tab.icon" class="size-5" />
          </UChip>
          <span v-if="tabLabels" class="text-[11px] leading-4 font-semibold">{{ tab.label }}</span>
        </UButton>
      </nav>
      <div v-show="snap !== 'peek'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <slot />
      </div>
    </template>
  </UDrawer>

  <!-- Beside the map: a column over its left edge that slides away when folded and is dragged wider or narrower. -->
  <section
    v-else
    class="bg-default border-default absolute inset-y-0 left-0 z-20 flex flex-col border-r"
    :class="[resizing ? '' : 'transition-transform duration-200 ease-out', open ? '' : '-translate-x-full']"
    :style="{ width: `${width}px` }"
    :inert="!open"
    aria-label="Panel">
    <slot />
    <!-- Drag to resize. -->
    <div
      v-if="open"
      class="hover:bg-brand-200 dark:hover:bg-brand-800 absolute top-0 -right-[3px] bottom-0 z-10 w-1.5 cursor-col-resize transition-colors duration-150"
      :class="{ 'bg-brand-200 dark:bg-brand-800': resizing }"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the panel"
      @pointerdown="emit('resize', $event)" />
  </section>
</template>

<script setup lang="ts">
  import { useWindowSize } from '@vueuse/core';
  import { computed } from 'vue';
  import { SHEET_HEIGHTS, SHEET_TOP_GAP } from '~/features/explorer/explorer.constants';
  import type { Section, SheetSnap } from '~/features/explorer/explorer.types';
  import { sheetHeightOf } from '~/features/explorer/layout.utils';

  const props = defineProps<{
    /** The phone's layout: a drawer, not a column. */
    phone: boolean;
    /** On a phone: its tabs show their names, under their icons. */
    tabLabels: boolean;
    /** Beside the map: whether the column is out. */
    open: boolean;
    /** Beside the map: the column's width, pixels. */
    width: number;
    /** Beside the map: its edge is being dragged. */
    resizing: boolean;
    /** The city's sections, as its tabs list them on a phone. */
    sections: { id: Section; label: string; icon: string }[];
    /** On a phone: the section its tabs mark open. */
    section: Section;
    /** Sections whose choice is in force, a dot on each icon (Plans while a plan is shown), with what the dot says. */
    marks: Partial<Record<Section, string>>;
  }>();
  const emit = defineEmits<{ pick: [section: Section]; resize: [event: PointerEvent] }>();
  defineSlots<{
    /** The open section. */
    default: () => unknown;
  }>();
  const snap = defineModel<SheetSnap>('snap', { required: true });

  // The drawer measures its snaps from the window's foot, as fractions of its height or in pixels:
  // its tabs, half, and all of it but the header's room, which depends on the window.
  const { height: windowHeight } = useWindowSize();
  const snapPoints = computed((): Record<SheetSnap, string> => ({
    peek: `${sheetHeightOf('peek', props.tabLabels)}px`,
    half: `${SHEET_HEIGHTS.half}px`,
    full: `${windowHeight.value - SHEET_TOP_GAP}px`,
  }));

  // Down to its tabs, no section is shown as open.
  const shown = computed(() => (snap.value === 'peek' ? null : props.section));

  /**
   * Follows the drawer to the snap it was dragged or tapped to.
   *
   * @param point - Where it came to rest, as the drawer gives it.
   */
  const toSnap = (point: number | string | null) => {
    const found = (Object.entries(snapPoints.value) as [SheetSnap, string][]).find(([, value]) => value === point);
    if (found) snap.value = found[0];
  };
</script>
