<template>
  <UCard class="w-60 bg-default/85 backdrop-blur" :ui="{ header: 'px-3 py-2 sm:px-3', body: 'px-3 pt-0 pb-3 sm:px-3 sm:pt-0' }">
    <template #header>
      <div class="flex items-center justify-between">
        <span class="text-highlighted text-sm font-semibold">Lines</span>
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
    <div v-show="!collapsed" class="max-h-[50vh] space-y-3 overflow-auto">
      <section v-for="group in groups" :key="group.network">
        <UCheckbox
          :modelValue="groupState(group.lines)"
          :label="group.name"
          :ui="{ label: 'font-semibold text-highlighted' }"
          @update:modelValue="toggleGroup(group.lines)" />
        <div class="mt-1.5 ml-1 space-y-1">
          <UCheckbox v-for="line in group.lines" :key="line.id" :modelValue="visible.has(line.id)" @update:modelValue="toggleLine(line.id)">
            <template #label>
              <span class="flex items-center gap-2">
                <span class="h-1.5 w-5 flex-none rounded-full" :style="{ background: line.color }" />
                {{ line.name }}
              </span>
            </template>
          </UCheckbox>
        </div>
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

  const groupState = (lines: LineInfo[]): boolean | 'indeterminate' => {
    const shown = lines.filter(line => props.visible.has(line.id)).length;
    if (shown === 0) return false;
    return shown === lines.length ? true : 'indeterminate';
  };

  const toggleLine = (lineId: string) => {
    const next = new Set(props.visible);
    if (next.has(lineId)) next.delete(lineId);
    else next.add(lineId);
    emit('change', next);
  };

  const toggleGroup = (lines: LineInfo[]) => {
    const next = new Set(props.visible);
    const show = groupState(lines) !== true;
    for (const line of lines) {
      if (show) next.add(line.id);
      else next.delete(line.id);
    }
    emit('change', next);
  };
</script>
