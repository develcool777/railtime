<template>
  <div class="flex flex-col gap-3.5 px-4 pt-3.5 pb-6">
    <UInput v-model="query" icon="i-lucide-search" placeholder="Find a line" size="lg" variant="soft" class="w-full" aria-label="Find a line" />
    <p v-if="groups.length === 0" class="text-muted text-sm">No line matches.</p>
    <section v-for="group in groups" :key="group.network">
      <div class="flex items-center justify-between px-2 pb-1">
        <h3 class="eyebrow text-muted truncate">{{ group.name }}</h3>
        <button type="button" class="text-primary flex-none text-xs font-semibold hover:underline" @click="toggleGroup(group.lines)">
          {{ anyShown(group.lines) ? 'Hide all' : 'Show all' }}
        </button>
      </div>
      <ul role="list">
        <li v-for="line in group.lines" :key="line.id" class="group/line hover:bg-elevated flex items-center gap-1 rounded-md transition-colors duration-150">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2.5 py-[7px] pl-2 text-left"
            :aria-pressed="visible.has(line.id)"
            :title="line.name"
            @click="toggleLine(line.id)">
            <!-- Filled when shown, a hollow outline when hidden. -->
            <span
              class="h-2 w-[22px] flex-none rounded-full border-2"
              :style="{ borderColor: line.color, background: visible.has(line.id) ? line.color : 'transparent' }" />
            <span class="flex-1 truncate text-sm font-medium" :class="visible.has(line.id) && isOpen(line) ? 'text-highlighted' : 'text-muted'">
              {{ line.name }}
            </span>
            <span class="text-muted flex-none text-xs tabular-nums">{{ line.opened === null ? 'Planned' : yearOf(line.opened) }}</span>
          </button>
          <button
            type="button"
            class="text-muted hover:text-primary focus-visible:text-primary flex-none px-2 py-[7px] text-xs font-semibold opacity-55 transition-opacity duration-150 group-hover/line:opacity-100 hover:opacity-100"
            :aria-label="isOnly(line.id) ? 'Show every line' : `Show only ${line.name}`"
            @click="showOnly(line.id)">
            {{ isOnly(line.id) ? 'All' : 'Only' }}
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { LineInfo } from '@railtime/renderer/transitMap.types';
  import { computed, ref } from 'vue';

  import { yearOf } from '~/utils/format.utils';

  const props = defineProps<{
    lines: LineInfo[];
    visible: Set<string>;
    /** The date shown, as a timestamp; `null` for a plan's future, when every line is open. */
    date: number | null;
  }>();
  const emit = defineEmits<{ change: [visible: Set<string>] }>();

  const query = ref('');

  const groups = computed(() => {
    const wanted = query.value.trim().toLowerCase();
    const byNetwork = new Map<string, { network: string; name: string; lines: LineInfo[] }>();
    for (const line of props.lines) {
      if (wanted && !line.name.toLowerCase().includes(wanted)) continue;
      // A plan's own lines come under their own heading, whatever brand they would run as.
      const network = line.opened === null ? 'planned' : line.network;
      const group = byNetwork.get(network) ?? { network, name: line.opened === null ? 'Planned' : line.networkName, lines: [] };
      group.lines.push(line);
      byNetwork.set(network, group);
    }
    return [...byNetwork.values()];
  });

  const shownCount = computed(() => props.lines.filter(line => props.visible.has(line.id)).length);

  /** Whether a line had opened by the date shown. */
  const isOpen = (line: LineInfo): boolean => props.date === null || (line.opened !== null && line.opened <= props.date);

  const anyShown = (lines: LineInfo[]): boolean => lines.some(line => props.visible.has(line.id));

  const isOnly = (lineId: string): boolean => shownCount.value === 1 && props.visible.has(lineId);

  const toggleLine = (lineId: string) => {
    const next = new Set(props.visible);
    if (next.has(lineId)) next.delete(lineId);
    else next.add(lineId);
    emit('change', next);
  };

  const toggleGroup = (lines: LineInfo[]) => {
    const next = new Set(props.visible);
    const show = !anyShown(lines);
    for (const line of lines) {
      if (show) next.add(line.id);
      else next.delete(line.id);
    }
    emit('change', next);
  };

  // A second press on the only line shown brings every line back.
  const showOnly = (lineId: string) => emit('change', isOnly(lineId) ? new Set(props.lines.map(line => line.id)) : new Set([lineId]));
</script>
