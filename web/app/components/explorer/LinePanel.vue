<template>
  <UCard class="w-72 bg-default/85 backdrop-blur" :ui="{ header: 'px-3 py-2 sm:px-3', body: 'px-2 pt-1 pb-2 sm:px-2 sm:pt-1 sm:pb-2' }">
    <template #header>
      <div class="flex items-center justify-between">
        <span class="text-highlighted text-sm font-semibold">
          Lines <span class="text-muted font-normal tabular-nums">{{ shownCount }}/{{ lines.length }}</span>
        </span>
        <UButton
          :icon="collapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="collapsed ? 'Show lines' : 'Hide lines'"
          :aria-expanded="!collapsed"
          @click="collapsed = !collapsed" />
      </div>
    </template>
    <div v-show="!collapsed" class="max-h-[50vh] space-y-2 overflow-auto">
      <section v-for="group in groups" :key="group.network">
        <div class="flex items-center justify-between px-1.5 pt-1">
          <span class="text-muted truncate text-xs font-medium">{{ group.name }}</span>
          <UButton
            :label="groupShown(group.lines) ? 'Hide all' : 'Show all'"
            color="neutral"
            variant="link"
            size="xs"
            class="flex-none px-0"
            @click="toggleGroup(group.lines)" />
        </div>
        <ul role="list">
          <li v-for="line in group.lines" :key="line.id" class="group/line flex items-center">
            <button
              type="button"
              class="hover:bg-elevated flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-sm"
              :aria-pressed="visible.has(line.id)"
              :title="line.name"
              @click="toggleLine(line.id)">
              <!-- Filled when shown, a hollow outline when hidden. -->
              <span
                class="h-2.5 w-6 flex-none rounded-full border-2"
                :style="{ borderColor: line.color, background: visible.has(line.id) ? line.color : 'transparent' }" />
              <span class="truncate" :class="visible.has(line.id) ? 'text-default' : 'text-dimmed'">{{ line.name }}</span>
            </button>
            <UButton
              :label="isOnly(line.id) ? 'All' : 'Only'"
              color="neutral"
              variant="ghost"
              size="xs"
              class="flex-none opacity-0 group-hover/line:opacity-100 focus-visible:opacity-100"
              :aria-label="isOnly(line.id) ? 'Show every line' : `Show only ${line.name}`"
              @click="showOnly(line.id)" />
          </li>
        </ul>
      </section>
    </div>
  </UCard>
</template>

<script setup lang="ts">
  import type { LineInfo } from '@railtime/renderer/transitMap.types';
  import { computed, ref } from 'vue';

  const props = defineProps<{
    lines: LineInfo[];
    visible: Set<string>;
  }>();
  const emit = defineEmits<{ change: [visible: Set<string>] }>();

  const collapsed = ref(false);

  const groups = computed(() => {
    const byNetwork = new Map<string, { network: string; name: string; lines: LineInfo[] }>();
    for (const line of props.lines) {
      const group = byNetwork.get(line.network) ?? { network: line.network, name: line.networkName, lines: [] };
      group.lines.push(line);
      byNetwork.set(line.network, group);
    }
    return [...byNetwork.values()];
  });

  const shownCount = computed(() => props.lines.filter(line => props.visible.has(line.id)).length);

  const groupShown = (lines: LineInfo[]): boolean => lines.every(line => props.visible.has(line.id));

  const isOnly = (lineId: string): boolean => shownCount.value === 1 && props.visible.has(lineId);

  const toggleLine = (lineId: string) => {
    const next = new Set(props.visible);
    if (next.has(lineId)) next.delete(lineId);
    else next.add(lineId);
    emit('change', next);
  };

  const toggleGroup = (lines: LineInfo[]) => {
    const next = new Set(props.visible);
    const show = !groupShown(lines);
    for (const line of lines) {
      if (show) next.add(line.id);
      else next.delete(line.id);
    }
    emit('change', next);
  };

  // A second press on the only line shown brings every line back.
  const showOnly = (lineId: string) => emit('change', isOnly(lineId) ? new Set(props.lines.map(line => line.id)) : new Set([lineId]));
</script>
