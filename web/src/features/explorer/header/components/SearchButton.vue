<template>
  <!-- The header's search, as a field to click: it opens the search, as ⌘K and / do. -->
  <button
    type="button"
    class="bg-muted border-default hover:border-accented flex h-9 w-full max-w-[420px] items-center gap-2 rounded-lg border px-3 text-left transition-colors duration-150"
    @click="emit('open')">
    <UIcon name="i-lucide-search" class="text-muted size-4 flex-none" />
    <span class="text-muted min-w-0 flex-1 truncate text-sm">Find a station or line…</span>
    <span class="flex flex-none gap-1">
      <UKbd value="meta" />
      <UKbd value="K" />
    </span>
  </button>
</template>

<script setup lang="ts">
  const emit = defineEmits<{ open: [] }>();
</script>
