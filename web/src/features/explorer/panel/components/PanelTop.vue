<template>
  <!-- One row: back (in a pushed view), the title and what it is of, close; the buttons sit on the title's line. -->
  <div class="border-muted flex flex-none items-start gap-1.5 border-b px-4 py-3">
    <UTooltip v-if="backLabel" :text="`Back to ${backLabel}`">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        class="-ml-1.5"
        :aria-label="`Back to ${backLabel}`"
        @click="emit('back')" />
    </UTooltip>
    <div class="min-w-0 flex-1">
      <h2 class="text-highlighted truncate text-lg leading-7 font-bold">{{ title }}</h2>
      <p v-if="context || dots?.length" class="text-muted flex min-w-0 items-center gap-1.5 text-xs leading-4">
        <span v-if="dots?.length" class="flex flex-none gap-1">
          <span v-for="color in dots" :key="color" class="size-2 rounded-full" :style="{ background: color }" />
        </span>
        <span class="truncate tabular-nums">{{ context }}</span>
      </p>
    </div>
    <UTooltip v-if="foldable" text="Close the panel" :kbds="['[']">
      <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" square class="-mr-1.5" aria-label="Close the panel" @click="emit('fold')" />
    </UTooltip>
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
