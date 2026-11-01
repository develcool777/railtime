<template>
  <div class="flex flex-col gap-2 px-4 pb-6">
    <PanelSearch v-model="query" placeholder="Search lines" />
    <UEmpty v-if="groups.length === 0" icon="i-lucide-search-x" title="No line matches" description="Try another name." />
    <section v-for="group in groups" :key="group.network">
      <div class="flex items-center justify-between gap-2 px-2 pb-1">
        <h3 class="eyebrow text-muted truncate">{{ group.name }}</h3>
        <!-- A network beside the city's own: on or off whole, the city's map without it when off. -->
        <USwitch
          v-if="group.optional"
          :modelValue="group.shown"
          size="sm"
          :label="`Show ${group.name}`"
          :ui="{ label: 'sr-only' }"
          @update:modelValue="emit('network', group.network, $event)" />
        <!-- The group's lines at once, its eye as each line's: open while every one shows. -->
        <UTooltip v-else :text="groupToggleLabel(group)">
          <UButton
            :icon="allShown(group.lines) ? 'i-lucide-eye' : 'i-lucide-eye-off'"
            color="neutral"
            variant="ghost"
            size="xs"
            class="flex-none"
            :aria-pressed="allShown(group.lines)"
            :aria-label="groupToggleLabel(group)"
            @click="toggleGroup(group.lines)" />
        </UTooltip>
      </div>
      <ul role="list">
        <li
          v-for="line in group.lines"
          :key="line.id"
          class="flex items-center"
          :class="{ 'opacity-40': !visible.has(line.id), 'opacity-55': visible.has(line.id) && !isOpen(line) }">
          <UButton
            :icon="visible.has(line.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'"
            color="neutral"
            variant="link"
            size="sm"
            class="text-dimmed hover:text-highlighted w-8 flex-none justify-center"
            :aria-pressed="visible.has(line.id)"
            :aria-label="visible.has(line.id) ? `Hide ${line.name}` : `Show ${line.name}`"
            @click="toggleLine(line.id)" />
          <ListRow class="min-w-0 flex-1 pl-0" @click="emit('open', line.id)">
            <span class="h-1.5 w-[22px] flex-none rounded-full" :style="{ background: lineColor(line.color) }" />
            <span class="text-highlighted flex-1 truncate text-sm leading-5 font-medium">{{ line.name }}</span>
            <span class="text-muted flex-none text-xs tabular-nums">{{ line.opened === null ? 'Planned' : yearOf(line.opened) }}</span>
            <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4 flex-none" />
          </ListRow>
        </li>
      </ul>
      <!-- Off, its lines only named, faded: turned on, they are the city's as any other. -->
      <ul v-if="group.offLines.length > 0" role="list" class="opacity-40">
        <li v-for="line in group.offLines" :key="line.id" class="flex h-9 items-center gap-2.5 pl-8">
          <span class="h-1.5 w-[22px] flex-none rounded-full" :style="{ background: lineColor(line.color) }" />
          <span class="text-highlighted flex-1 truncate text-sm leading-5 font-medium">{{ line.name }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { LineInfo, OptionalNetworkInfo } from '@railtime/network/facts.types';
  import { computed, ref } from 'vue';

  import { yearOf } from '@railtime/core/date.utils';
  import { lineColor } from '~/features/explorer/format.utils';
  import type { LineGroup } from '~/features/explorer/lines/line.types';
  import { lineGroups } from '~/features/explorer/lines/line.utils';

  const props = defineProps<{
    lines: LineInfo[];
    /** The networks the city may show or leave off: those off are listed after its own. */
    optional: OptionalNetworkInfo[];
    visible: Set<string>;
    /** The date shown, as a timestamp; `null` for a plan's future, when every line is open. */
    date: number | null;
  }>();
  const emit = defineEmits<{ change: [visible: Set<string>]; network: [network: string, shown: boolean]; open: [line: string] }>();

  const query = ref('');

  const groups = computed(() => lineGroups(props.lines, props.optional, query.value));

  /** Whether a line had opened by the date shown. */
  const isOpen = (line: LineInfo): boolean => props.date === null || (line.opened !== null && line.opened <= props.date);

  const toggleLine = (lineId: string) => {
    const next = new Set(props.visible);
    if (next.has(lineId)) next.delete(lineId);
    else next.add(lineId);
    emit('change', next);
  };

  /** Whether every line of a group shows. */
  const allShown = (lines: LineInfo[]): boolean => lines.every(line => props.visible.has(line.id));

  /** What the group's eye does: hides its lines while all show, else shows them all. */
  const groupToggleLabel = (group: LineGroup): string => (allShown(group.lines) ? `Hide all ${group.name} lines` : `Show all ${group.name} lines`);

  const toggleGroup = (lines: LineInfo[]) => {
    const next = new Set(props.visible);
    const show = !allShown(lines);
    for (const line of lines) {
      if (show) next.add(line.id);
      else next.delete(line.id);
    }
    emit('change', next);
  };
</script>
