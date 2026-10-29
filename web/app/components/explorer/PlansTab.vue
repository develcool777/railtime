<template>
  <div class="flex flex-col gap-2.5 p-4">
    <p class="text-muted text-[13px] leading-relaxed">
      A plan is a future the city has drawn up. Pick one to see the network as it would be; unbuilt track is dashed.
    </p>
    <button
      v-for="card in cards"
      :key="card.id ?? NO_PLAN"
      type="button"
      class="plan-card"
      :class="{ selected: card.id === plan }"
      :aria-pressed="card.id === plan"
      @click="emit('choose', card.id)">
      <span class="flex items-start justify-between gap-2">
        <span class="text-highlighted text-[15px] leading-snug font-bold">{{ card.name }}</span>
        <StatusChip v-if="card.status" :tone="PLAN_STATUSES[card.status].tone">{{ PLAN_STATUSES[card.status].label }}</StatusChip>
      </span>
      <!-- Three lines each; the plan shown in full. -->
      <span v-if="card.description" class="text-default text-[13px] leading-normal" :class="{ 'line-clamp-3': card.id !== plan }">{{ card.description }}</span>
      <span v-if="card.lines.length > 0 || card.facts" class="mt-0.5 flex items-center gap-2">
        <span class="flex flex-wrap gap-1">
          <span v-for="line in card.lines" :key="line.id" class="h-1.5 w-3.5 rounded-full" :style="{ background: line.color }" :title="line.name" />
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

  import StatusChip from '~/components/common/StatusChip.vue';
  import { PLAN_STATUSES } from '~/utils/explorer.constants';
  import { formatPlanFacts } from '~/utils/format.utils';
  import { planFacts } from '~/utils/plan.utils';

  const props = defineProps<{
    network: Network;
    /** The plan shown, if any. */
    plan?: string;
  }>();
  const emit = defineEmits<{ choose: [plan: string | undefined] }>();

  /** The key of the card for the network as it is. */
  const NO_PLAN = 'current';
  const colorMode = useColorMode();

  // Building every plan once, as the tab opens: what each adds does not change.
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
        lines: lines.map(line => ({ id: line.id, name: line.name, color: dark ? line.darkColor : line.color })),
        facts: formatPlanFacts(stations, km),
      };
    });
    // A network never built has nothing to show without a plan.
    if (isPlanOnly(props.network)) return plans;
    return [
      { id: undefined, name: 'Current network', status: undefined, description: 'The network as it is today, and its history.', lines: [], facts: '' },
      ...plans,
    ];
  });
</script>

<style scoped>
  .plan-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 14px 14px 12px;
    text-align: left;
    border: 1px solid var(--ui-border);
    border-radius: 12px;
    background: var(--ui-bg);
    box-shadow: var(--rt-shadow-card);
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  .plan-card:hover {
    border-color: var(--ui-border-accented);
  }
  .plan-card.selected {
    border-color: var(--ui-primary);
    background: var(--rt-selected-bg);
    box-shadow: var(--rt-shadow-card-hover);
  }
</style>
