<template>
  <div class="border-default bg-muted flex flex-none gap-0.5 rounded-lg border p-[3px]" role="radiogroup" :aria-label="label">
    <button
      v-for="item in items"
      :key="String(item.value)"
      type="button"
      role="radio"
      :aria-checked="item.value === modelValue"
      class="h-[30px] min-w-[34px] rounded-md px-2 text-[13px] font-semibold transition-colors duration-150"
      :class="item.value === modelValue ? 'bg-default text-highlighted shadow-card' : 'text-muted hover:text-highlighted'"
      @click="emit('update:modelValue', item.value)">
      {{ item.label }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="Value extends string | number">
  defineProps<{
    items: { label: string; value: Value }[];
    modelValue: Value;
    /** What the control sets, for screen readers. */
    label: string;
  }>();
  const emit = defineEmits<{ 'update:modelValue': [value: Value] }>();
</script>
