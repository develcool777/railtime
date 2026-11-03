<template>
  <div class="flex flex-col gap-2 px-4 pb-6">
    <PanelSearch v-model="query" placeholder="Search lines" />
    <UEmpty v-if="groups.length === 0" icon="i-lucide-search-x" title="No line matches" description="Try another name." />
    <section v-for="group in groups" :key="group.network">
      <div class="flex items-center justify-between gap-2 px-2 pb-1">
        <h3 class="eyebrow text-muted truncate">{{ group.name }}</h3>
        <!-- The network's lines at once, its eye as each line's: open while every one shows. -->
        <UTooltip v-if="group.toggleable.length > 0" :text="groupToggleLabel(group)">
          <UButton
            :icon="allShown(group) ? 'i-lucide-eye' : 'i-lucide-eye-off'"
            color="neutral"
            variant="ghost"
            size="xs"
            class="flex-none"
            :aria-pressed="allShown(group)"
            :aria-label="groupToggleLabel(group)"
            @click="emit('show', group.toggleable, !allShown(group))" />
        </UTooltip>
      </div>
      <ul role="list">
        <!-- A line hidden keeps its place, only named, faded, to be shown again. -->
        <li
          v-for="entry in group.entries"
          :key="entry.id"
          class="flex min-h-9 items-center"
          :class="{ 'opacity-40': !entry.shown, 'opacity-55': entry.shown && !isOpen(entry.shown) }">
          <UButton
            v-if="group.toggleable.length > 0"
            :icon="entry.shown ? 'i-lucide-eye' : 'i-lucide-eye-off'"
            color="neutral"
            variant="link"
            size="sm"
            class="text-dimmed hover:text-highlighted w-8 flex-none justify-center"
            :aria-pressed="entry.shown !== null"
            :aria-label="entry.shown ? `Hide ${entry.name}` : `Show ${entry.name}`"
            @click="emit('show', [entry.id], !entry.shown)" />
          <ListRow v-if="entry.shown" class="min-w-0 flex-1" :class="{ 'pl-0': group.toggleable.length > 0 }" @click="emit('open', entry.id)">
            <span class="h-1.5 w-[22px] flex-none rounded-full" :style="{ background: lineColor(entry.color) }" />
            <span class="text-highlighted flex-1 truncate text-sm leading-5 font-medium">{{ entry.name }}</span>
            <span class="text-muted flex-none text-xs tabular-nums">{{ entry.shown.opened === null ? 'Planned' : yearOf(entry.shown.opened) }}</span>
            <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4 flex-none" />
          </ListRow>
          <span v-else class="flex min-w-0 flex-1 items-center gap-2.5">
            <span class="h-1.5 w-[22px] flex-none rounded-full" :style="{ background: lineColor(entry.color) }" />
            <span class="text-highlighted flex-1 truncate text-sm leading-5 font-medium">{{ entry.name }}</span>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { LineInfo, NetworkChoice } from '@railtime/network/facts.types';
  import { computed, ref } from 'vue';

  import { yearOf } from '@railtime/core/date.utils';
  import { lineColor } from '~/features/explorer/format.utils';
  import type { LineGroup } from '~/features/explorer/lines/line.types';
  import { lineGroups } from '~/features/explorer/lines/line.utils';

  const props = defineProps<{
    /** The lines on the map. */
    lines: LineInfo[];
    /** Each network with the lines that may be shown or hidden: those hidden are listed after the rest. */
    choices: NetworkChoice[];
    /** The date shown, as a timestamp; `null` in a plan, when every line is open. */
    date: number | null;
  }>();
  const emit = defineEmits<{ show: [lines: string[], shown: boolean]; open: [line: string] }>();

  const query = ref('');

  const groups = computed(() => lineGroups(props.lines, props.choices, query.value));

  /** Whether a line had opened by the date shown. */
  const isOpen = (line: LineInfo): boolean => props.date === null || (line.opened !== null && line.opened <= props.date);

  /** Whether every line of a group shows. */
  const allShown = (group: LineGroup): boolean => props.choices.every(choice => choice.id !== group.network || choice.lines.every(line => line.shown));

  /** What the group's eye does: hides its lines while all show, else shows them all. */
  const groupToggleLabel = (group: LineGroup): string => (allShown(group) ? `Hide all ${group.name} lines` : `Show all ${group.name} lines`);
</script>
