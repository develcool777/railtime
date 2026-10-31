<template>
  <!-- One plan at a time, or the network as built: a choice of cards. -->
  <URadioGroup :modelValue="plan ?? BUILT" :items="cards" variant="card" indicator="end" class="p-4" aria-label="Plans" @update:modelValue="choose">
    <template #label="{ item }">
      <span class="flex items-start justify-between gap-2">
        <span class="text-highlighted text-sm leading-5 font-bold">{{ item.name }}</span>
        <UBadge v-if="item.status" :color="PLAN_STATUSES[item.status].color" :label="PLAN_STATUSES[item.status].label" />
      </span>
    </template>
    <template #description="{ item }">
      <span class="flex flex-col gap-1.5 pt-1">
        <!-- Two lines each; the plan shown in full. -->
        <span v-if="item.description" class="text-default text-xs leading-4" :class="{ 'line-clamp-2': item.value !== (plan ?? BUILT) }">{{
          item.description
        }}</span>
        <span v-if="item.colors.length > 0 || item.facts" class="flex items-center gap-2">
          <span class="flex flex-wrap gap-1">
            <span v-for="color in item.colors" :key="color" class="h-1.5 w-[22px] rounded-full" :style="{ background: color }" />
          </span>
          <span class="text-muted text-xs tabular-nums">{{ item.facts }}</span>
        </span>
      </span>
    </template>
  </URadioGroup>
</template>

<script setup lang="ts">
  import { useColorMode } from '#imports';
  import type { Network, PlanStatus } from '@railtime/schema/network.types';
  import { isPlanOnly } from '@railtime/schema/plan.utils';
  import { computed } from 'vue';

  import { PLAN_STATUSES } from '~/features/explorer/plans/plan.constants';
  import { formatPlanFacts } from '~/features/explorer/format.utils';
  import { planFacts } from '@railtime/network/plan.utils';

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

  /** Shows the plan picked, or the network as built. */
  const choose = (value: unknown) => emit('choose', value === BUILT ? undefined : String(value));

  const cards = computed(() => {
    const dark = colorMode.value !== 'light';
    const plans = Object.entries(props.network.plans ?? {}).map(([id, plan]) => {
      // Every plan has its facts: they were worked out for each id above.
      const { stations, km, lines } = facts[id]!;
      return {
        value: id,
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
      { value: BUILT, name: 'Built', status: undefined, description: 'The network as it is today, and its history.', colors: [], facts: props.built },
      ...plans,
    ];
  });
</script>
