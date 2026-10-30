<template>
  <ul class="flex flex-col gap-1.5" role="list">
    <li v-for="station in stations" :key="station.id">
      <button
        type="button"
        class="border-default hover:border-primary flex h-10 w-full items-center gap-2.5 rounded-lg border px-3 text-left transition-colors duration-150"
        @click="emit('select', station.id)">
        <span class="flex flex-none gap-0.5">
          <span v-for="line in station.lines" :key="line.id" class="h-1.5 w-3 rounded-full" :style="{ background: line.color }" :title="line.name" />
        </span>
        <span class="text-highlighted flex-1 truncate text-sm font-medium">{{ station.name }}</span>
        <UIcon name="i-lucide-arrow-right" class="text-muted size-4 flex-none" />
      </button>
    </li>
  </ul>
</template>

<script setup lang="ts">
  defineProps<{
    /** Each station with the lines' colours to show beside it. */
    stations: { id: string; name: string; lines: { id: string; name: string; color: string }[] }[];
  }>();
  const emit = defineEmits<{ select: [station: string] }>();
</script>
