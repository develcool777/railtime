<template>
  <!-- A long list that builds only the rows in sight, and a few past them: as tall as all of them, each placed where it falls, and each saying where it stands in the whole. -->
  <div ref="root" class="relative" :style="{ height: `${virtualizer.getTotalSize() - scrollMargin}px` }">
    <!-- The heading of the row at the top, stuck under what covers the panel's top, over the row's own: no room of its own, and read once, from the list. -->
    <div v-if="slots.sticky && topRow !== null" class="sticky z-1 h-0" :style="{ top: `${covered}px` }" aria-hidden="true">
      <slot name="sticky" :row="rows[topRow]!" />
    </div>
    <div
      role="list"
      :aria-label="label"
      class="absolute inset-x-0 top-0"
      :style="{ transform: `translateY(${(shown[0]?.start ?? scrollMargin) - scrollMargin}px)` }">
      <div
        v-for="item in shown"
        :key="String(item.key)"
        :ref="measure"
        role="listitem"
        :aria-setsize="rows.length"
        :aria-posinset="item.index + 1"
        :data-index="item.index">
        <slot name="row" :row="rows[item.index]!" :index="item.index" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="Row extends { key: string }">
  import { useVirtualizer } from '@tanstack/vue-virtual';
  import { computed, onMounted, ref, shallowRef, useTemplateRef } from 'vue';

  import { PANEL_LIST_OVERSCAN } from '~/features/explorer/panel/panel.constants';

  const props = defineProps<{
    /** What the list is, for a screen reader: "Changes". */
    label: string;
    /** Every row, in order, each with a key of its own. */
    rows: Row[];
    /** How tall a row is likely to stand before it is measured, pixels. */
    estimate: (row: Row) => number;
    /** Pixels at the top of the panel that something stuck there covers (the search): the top row is the one under them. */
    covered: number;
  }>();
  const slots = defineSlots<{
    /** A row. */
    row: (scope: { row: Row; index: number }) => unknown;
    /** The heading of the row at the top, kept in sight as the list scrolls. */
    sticky?: (scope: { row: Row }) => unknown;
  }>();

  const root = useTemplateRef<HTMLElement>('root');
  /** The panel's body, which scrolls the list. */
  const scroller = shallowRef<HTMLElement | null>(null);
  /** How far down the scroller the list starts, under what comes before it, pixels. */
  const scrollMargin = ref(0);

  const virtualizer = useVirtualizer(
    // Made again once the scroller is found, so the list starts measuring it.
    computed(() => {
      const element = scroller.value;
      return {
        count: props.rows.length,
        getScrollElement: () => element,
        estimateSize: (index: number) => props.estimate(props.rows[index]!),
        getItemKey: (index: number) => props.rows[index]!.key,
        overscan: PANEL_LIST_OVERSCAN,
        scrollMargin: scrollMargin.value,
      };
    }),
  );
  const shown = computed(() => virtualizer.value.getVirtualItems());

  /**
   * Measures a row as it is built, and again as it changes size.
   *
   * @param element - The row's element, or nothing as it goes.
   */
  const measure = (element: unknown) => {
    if (element instanceof Element) virtualizer.value.measureElement(element);
  };

  /**
   * The nearest box above that scrolls: the panel's body.
   *
   * @param element - Where to start.
   * @returns The box, or `null` for none.
   */
  const scrollParentOf = (element: HTMLElement | null): HTMLElement | null => {
    const parent = element?.parentElement ?? null;
    if (!parent) return null;
    return /auto|scroll/.test(getComputedStyle(parent).overflowY) ? parent : scrollParentOf(parent);
  };

  // In the browser only: the scroller, and where the list starts in it, under the search above it.
  onMounted(() => {
    scroller.value = scrollParentOf(root.value);
    if (!root.value || !scroller.value) return;
    scrollMargin.value = root.value.getBoundingClientRect().top - scroller.value.getBoundingClientRect().top + scroller.value.scrollTop;
  });

  /** The row at the top of what shows, under whatever is stuck there; `null` with no rows. */
  const topRow = computed(() => {
    const offset = (virtualizer.value.scrollOffset ?? 0) + props.covered;
    return virtualizer.value.getVirtualItemForOffset(offset)?.index ?? null;
  });

  defineExpose({
    /**
     * Scrolls a row into the middle of what shows.
     *
     * @param index - The row.
     * @param behavior - At once, or smoothly.
     */
    centre: (index: number, behavior: 'auto' | 'smooth') => {
      // The virtualizer's own smooth scroll corrects its target as rows are measured on the way, and
      // starts again with each call, so a list followed while playing jerks back and forth: smoothly,
      // the browser scrolls once to where the row stands now.
      if (behavior === 'auto') return virtualizer.value.scrollToIndex(index, { align: 'center' });
      const [offset] = virtualizer.value.getOffsetForIndex(index, 'center') ?? [];
      if (offset !== undefined) scroller.value?.scrollTo({ top: offset, behavior: 'smooth' });
    },
  });
</script>
