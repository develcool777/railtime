<template>
  <div class="flex flex-col gap-2 p-4">
    <button
      v-for="card in cards"
      :key="card.id ?? BUILT"
      type="button"
      class="flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors duration-150"
      :class="card.id === plan ? 'border-primary bg-selected' : 'border-default bg-default hover:border-accented'"
      :aria-pressed="card.id === plan"
      @click="emit('choose', card.id)">
      <span class="flex items-start justify-between gap-2">
        <span class="text-highlighted text-sm leading-5 font-bold">{{ card.name }}</span>
        <StatusChip v-if="card.status" :tone="PLAN_STATUSES[card.status].tone">{{ PLAN_STATUSES[card.status].label }}</StatusChip>
      </span>
      <!-- Two lines each; the plan shown in full. -->
      <span v-if="card.description" class="text-default text-xs leading-4" :class="{ 'line-clamp-2': card.id !== plan }">{{ card.description }}</span>
      <span v-if="card.colors.length > 0 || card.facts" class="flex items-center gap-2">
        <span class="flex flex-wrap gap-1">
          <span v-for="color in card.colors" :key="color" class="h-1.5 w-[22px] rounded-full" :style="{ background: color }" />
        </span>
        <span class="text-muted text-xs tabular-nums">{{ card.facts }}</span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { useColorMode } from '#imports';
  import type { Network, PlanStatus } from '@railtime/schema/network.types';
  import { isPlanOnly } from '@railtime/schema/plan.utils';
  import { computed } from 'vue';

  import { PLAN_STATUSES } from '~/features/explorer/explorer.constants';
  import { formatPlanFacts } from '~/features/explorer/format.utils';
  import { planFacts } from '~/features/explorer/plan.utils';

  const props = defineProps<{
    network: Network;
    /** The plan shown, if any. */
    plan?: string;
    /** What is built today, in a line: the first card's facts. */
    built: string;
  }>();
  const emit = defineEmits<{ choose: [plan: string | undefined] }>();

  /** The key of the card for the network as it is. */
  const BUILT = 'built';
  const colorMode = useColorMode();

  // Building every plan once, as the section opens: what each adds does not change.
  const facts = Object.fromEntries(Object.keys(props.network.plans ?? {}).map(id => [id, planFacts(props.network, id)]));

  const cards = computed(() => {
    const dark = colorMode.value !== 'light';
    const plans = Object.entries(props.network.plans ?? {}).map(([id, plan]) => {
      // Every plan has its facts: they were worked out for each id above.
      const { stations, km, lines } = facts[id]!;
      return {
        id: id as string | undefined,
        name: plan.name,
        status: plan.status as PlanStatus | undefined,
        description: plan.description,
        colors: [...new Set(lines.map(line => (dark ? line.darkColor : line.color)))],
        facts: formatPlanFacts(stations, km),
      };
    });
    // A network never built has nothing to show without a plan.
    if (isPlanOnly(props.network)) return plans;
    return [
      { id: undefined, name: 'Built', status: undefined, description: 'The network as it is today, and its history.', colors: [], facts: props.built },
      ...plans,
    ];
  });
</script>
