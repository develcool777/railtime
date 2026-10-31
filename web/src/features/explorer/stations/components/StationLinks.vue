<template>
  <ul class="-mx-2 flex flex-col" role="list">
    <li v-for="station in stations" :key="station.id">
      <ListRow @click="emit('select', station.id)">
        <span class="flex flex-none gap-0.5">
          <span v-for="line in station.lines" :key="line.id" class="h-1.5 w-3 rounded-full" :style="{ background: line.color }" :title="line.name" />
        </span>
        <span class="text-highlighted flex-1 truncate text-sm font-medium">{{ station.name }}</span>
      </ListRow>
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
