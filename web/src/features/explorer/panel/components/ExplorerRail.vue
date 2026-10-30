<template>
  <nav class="border-default bg-muted flex w-18 flex-none flex-col items-center gap-1 border-r py-2" aria-label="Sections">
    <UTooltip v-for="(section, position) in sections" :key="section.id" :text="section.label" :kbds="[String(position + 1)]" :content="{ side: 'right' }">
      <button
        type="button"
        class="flex h-14 w-15 flex-col items-center justify-center gap-1 rounded-lg transition-colors duration-150"
        :class="section.id === open ? 'bg-selected text-selected' : 'text-muted hover:bg-elevated hover:text-highlighted'"
        :aria-pressed="section.id === open"
        @click="emit('pick', section.id)">
        <UIcon :name="section.icon" class="size-5" />
        <span class="text-[11px] leading-4 font-semibold">{{ section.label }}</span>
      </button>
    </UTooltip>
  </nav>
</template>

<script setup lang="ts">
  import type { Section } from '~/features/explorer/explorer.types';

  defineProps<{
    sections: { id: Section; label: string; icon: string }[];
    /** The section open in the panel; none while it is folded. */
    open: Section | null;
  }>();
  const emit = defineEmits<{ pick: [section: Section] }>();
</script>
