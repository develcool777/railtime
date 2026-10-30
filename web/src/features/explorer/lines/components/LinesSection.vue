<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-6">
    <UInput
      v-model="query"
      icon="i-lucide-search"
      placeholder="Search lines"
      variant="none"
      class="w-full"
      :ui="{ base: 'bg-muted ring-muted focus-visible:ring-primary h-9 rounded-lg ring ring-inset focus-visible:ring-2' }"
      aria-label="Search lines" />
    <p v-if="groups.length === 0" class="text-muted text-sm">No line matches.</p>
    <section v-for="group in groups" :key="group.network">
      <div class="flex items-center justify-between gap-2 px-2 pb-1">
        <h3 class="eyebrow text-muted truncate">{{ group.name }}</h3>
        <span class="flex flex-none gap-2.5 text-xs font-semibold">
          <button type="button" class="text-primary hover:underline" @click="showGroup(group.lines)">Show all</button>
          <button type="button" class="text-muted hover:text-highlighted" @click="showOnly(group.lines)">Only these</button>
        </span>
      </div>
      <ul role="list">
        <li
          v-for="line in group.lines"
          :key="line.id"
          class="hover:bg-elevated flex h-9 items-center rounded-md transition-colors duration-150"
          :class="{ 'opacity-40': !visible.has(line.id), 'opacity-55': visible.has(line.id) && !isOpen(line) }">
          <button
            type="button"
            class="text-dimmed hover:text-highlighted flex h-full w-8 flex-none items-center justify-center"
            :aria-pressed="visible.has(line.id)"
            :aria-label="visible.has(line.id) ? `Hide ${line.name}` : `Show ${line.name}`"
            @click="toggleLine(line.id)">
            <UIcon :name="visible.has(line.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'" class="size-4" />
          </button>
          <button type="button" class="flex h-full min-w-0 flex-1 items-center gap-2.5 pr-2 text-left" @click="emit('open', line.id)">
            <span class="h-1.5 w-[22px] flex-none rounded-full" :style="{ background: line.color }" />
            <span class="text-highlighted flex-1 truncate text-sm leading-5 font-medium">{{ line.name }}</span>
            <span class="text-muted flex-none text-xs tabular-nums">{{ line.opened === null ? 'Planned' : yearOf(line.opened) }}</span>
            <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4 flex-none" />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { LineInfo } from '@railtime/renderer/transitMap.types';
  import { computed, ref } from 'vue';

  import { yearOf } from '~/features/explorer/format.utils';
  import { foldName } from '~/features/explorer/stations/station.utils';

  const props = defineProps<{
    lines: LineInfo[];
    visible: Set<string>;
    /** The date shown, as a timestamp; `null` for a plan's future, when every line is open. */
    date: number | null;
  }>();
  const emit = defineEmits<{ change: [visible: Set<string>]; open: [line: string] }>();

  const query = ref('');

  const groups = computed(() => {
    const wanted = foldName(query.value);
    const byNetwork = new Map<string, { network: string; name: string; lines: LineInfo[] }>();
    for (const line of props.lines) {
      if (wanted && !foldName(line.name).includes(wanted)) continue;
      // A plan's own lines come under their own heading, whatever brand they would run as.
      const network = line.opened === null ? 'planned' : line.network;
      const group = byNetwork.get(network) ?? { network, name: line.opened === null ? 'Planned' : line.networkName, lines: [] };
      group.lines.push(line);
      byNetwork.set(network, group);
    }
    return [...byNetwork.values()];
  });

  /** Whether a line had opened by the date shown. */
  const isOpen = (line: LineInfo): boolean => props.date === null || (line.opened !== null && line.opened <= props.date);

  const toggleLine = (lineId: string) => {
    const next = new Set(props.visible);
    if (next.has(lineId)) next.delete(lineId);
    else next.add(lineId);
    emit('change', next);
  };

  const showGroup = (lines: LineInfo[]) => emit('change', new Set([...props.visible, ...lines.map(line => line.id)]));

  // Only these lines on the map; pressed again with only them shown, every line comes back.
  const showOnly = (lines: LineInfo[]) => {
    const ids = new Set(lines.map(line => line.id));
    const onlyThese = props.visible.size === ids.size && [...ids].every(id => props.visible.has(id));
    emit('change', onlyThese ? new Set(props.lines.map(line => line.id)) : ids);
  };
</script>
