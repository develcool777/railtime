<template>
  <nav class="border-default bg-muted flex w-18 flex-none flex-col items-center gap-1 border-r py-2" aria-label="Sections">
    <UTooltip v-for="(section, position) in sections" :key="section.id" :text="section.label" :kbds="[String(position + 1)]" :content="{ side: 'right' }">
      <UButton
        color="neutral"
        variant="ghost"
        :active="section.id === open"
        activeColor="primary"
        activeVariant="soft"
        class="text-muted h-14 w-15 flex-col justify-center gap-1"
        :aria-pressed="section.id === open"
        :aria-description="marks[section.id]"
        @click="emit('pick', section.id)">
        <!-- A dot while the section's choice is in force: a plan shown, a route set. -->
        <UChip :show="!!marks[section.id]" size="md">
          <UIcon :name="section.icon" class="size-5" />
        </UChip>
        <span class="text-[11px] leading-4 font-semibold">{{ section.label }}</span>
      </UButton>
    </UTooltip>
  </nav>
</template>

<script setup lang="ts">
  import type { Section } from '~/features/explorer/explorer.types';

  defineProps<{
    sections: { id: Section; label: string; icon: string }[];
    /** The section open in the panel; none while it is folded. */
    open: Section | null;
    /** Sections whose choice is in force, a dot on each icon (Plans while a plan is shown), with what the dot says. */
    marks: Partial<Record<Section, string>>;
  }>();
  const emit = defineEmits<{ pick: [section: Section] }>();
</script>
