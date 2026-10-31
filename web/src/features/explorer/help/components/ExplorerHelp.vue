<template>
  <UModal
    :open
    title="What you can do"
    description="The map, its history, and the panel beside it"
    :ui="{ content: 'max-w-2xl' }"
    @update:open="emit('update:open', $event)">
    <template #body>
      <div class="flex flex-col gap-6">
        <section v-for="topic in HELP_TOPICS" :key="topic.title" class="flex flex-col gap-2">
          <h3 class="text-highlighted text-sm font-bold">{{ topic.title }}</h3>
          <ul class="flex flex-col gap-2">
            <li v-for="item in topic.items" :key="item.label" class="flex items-start gap-3">
              <UIcon :name="item.icon" class="text-muted mt-0.5 size-4 flex-none" />
              <p class="text-sm">
                <span class="text-highlighted font-semibold">{{ item.label }}</span>
                <span class="text-muted"> · {{ item.description }}</span>
              </p>
            </li>
          </ul>
        </section>

        <section class="flex flex-col gap-2">
          <h3 class="text-highlighted text-sm font-bold">The panel</h3>
          <ul class="flex flex-col gap-2">
            <li v-for="entry in sections" :key="entry.id" class="flex items-start gap-3">
              <UIcon :name="entry.icon" class="text-muted mt-0.5 size-4 flex-none" />
              <p class="text-sm">
                <span class="text-highlighted font-semibold">{{ entry.label }}</span>
                <span class="text-muted"> · {{ entry.description }}</span>
              </p>
            </li>
          </ul>
        </section>

        <section v-if="!phone" class="flex flex-col gap-2">
          <h3 class="text-highlighted text-sm font-bold">Keys</h3>
          <ul class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <li v-for="shortcut in keys" :key="shortcut.label" class="flex items-center justify-between gap-3 text-sm">
              <span class="text-muted">{{ shortcut.label }}</span>
              <span class="flex flex-none gap-1">
                <UKbd v-for="kbd in shortcut.kbds" :key="kbd" :value="kbd" />
              </span>
            </li>
          </ul>
        </section>

        <p class="text-muted text-sm">
          The address keeps what you see (the day, where the map looks, the tab, the station or line open, 3D, the names, map only): copy it to share it.
        </p>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
  import { computed } from 'vue';

  import type { SectionEntry } from '~/features/explorer/explorer.types';
  import { HELP_TOPICS } from '~/features/explorer/help/help.constants';
  import { SHORTCUTS } from '~/features/explorer/shortcuts.constants';

  const props = defineProps<{
    open: boolean;
    /** The city's sections, as the rail lists them. */
    sections: SectionEntry[];
    /** On a phone: no keys to list. */
    phone: boolean;
  }>();
  const emit = defineEmits<{ 'update:open': [open: boolean] }>();

  /** The keys, with the number keys' and Esc's, which the shortcuts make from the sections and the views open. */
  const keys = computed(() => [
    ...SHORTCUTS,
    { label: 'Open a section, in the rail’s order', kbds: ['1', '–', String(props.sections.length)] },
    { label: 'Close, or go back', kbds: ['Esc'] },
  ]);
</script>
