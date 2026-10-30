<template>
  <div class="border-muted flex-none border-b px-4 pt-3.5 pb-3">
    <div v-if="backLabel || foldable" class="flex h-6 items-center justify-between">
      <button v-if="backLabel" type="button" class="text-muted hover:text-highlighted flex items-center gap-0.5 text-xs font-medium" @click="emit('back')">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        {{ backLabel }}
      </button>
      <span v-else />
      <UTooltip v-if="foldable" text="Close the panel" :kbds="['[']">
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          class="size-7 rounded-md"
          aria-label="Close the panel"
          @click="emit('fold')" />
      </UTooltip>
    </div>
    <h2 class="text-highlighted truncate text-lg leading-6 font-bold">{{ title }}</h2>
    <p v-if="context || dots?.length" class="text-muted flex min-w-0 items-center gap-1.5 text-xs leading-4">
      <span v-if="dots?.length" class="flex flex-none gap-1">
        <span v-for="color in dots" :key="color" class="size-2 rounded-full" :style="{ background: color }" />
      </span>
      <span class="truncate tabular-nums">{{ context }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    title: string;
    /** A line under the title: the section's counts, or what the view is of. */
    context?: string;
    /** Line colours leading the context. */
    dots?: string[];
    /** Where the back link returns to, in a pushed view. */
    backLabel?: string;
    /** Whether it has the fold button: beside the map, not in the phone's sheet. */
    foldable?: boolean;
  }>();
  const emit = defineEmits<{ back: []; fold: [] }>();
</script>
