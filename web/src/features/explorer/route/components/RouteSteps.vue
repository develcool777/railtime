<template>
  <!-- A way as a track: a ring where each ride is boarded, its line down to the next, a dot at the end. -->
  <ol class="flex flex-col" role="list" :aria-label="`The way taking ${Math.round(route.minutes)} min`">
    <li v-for="(leg, position) in route.legs" :key="position" class="relative pb-4 pl-7">
      <template v-if="leg.kind === 'ride'">
        <span class="absolute top-2 -bottom-2 left-[5px] w-1 rounded-full" :style="{ background: lineColor(leg.color) }" />
        <span class="bg-default absolute top-0.5 left-0 size-3.5 rounded-full border-[3px]" :style="{ borderColor: lineColor(leg.color) }" />
        <div class="flex items-center justify-between gap-2">
          <UButton
            :label="leg.stops[0]?.name"
            color="neutral"
            variant="link"
            class="text-highlighted p-0 text-sm leading-5 font-semibold"
            @click="leg.stops[0] && emit('station', leg.stops[0].id)" />
          <span v-if="position > 0" class="eyebrow text-muted flex-none">Change</span>
        </div>
        <p class="text-default mt-0.5 text-xs">
          <span class="font-semibold">{{ leg.lineName }}</span>
          <span class="text-muted"> to {{ leg.stops.at(-1)?.name }}</span>
        </p>
        <!-- The stops it passes, on request, each a dot on its line. -->
        <UCollapsible v-if="leg.stops.length > 2" :open="unfolded.has(position)" class="mt-1" @update:open="toggle(position)">
          <UButton
            :label="rideSummary(leg)"
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="link"
            size="xs"
            class="group text-muted gap-1 p-0 tabular-nums"
            :ui="{ leadingIcon: 'size-3.5 transition-transform duration-150 group-data-[state=open]:rotate-90' }" />
          <template #content>
            <ul class="mt-1" role="list">
              <li v-for="stop in leg.stops.slice(1, -1)" :key="stop.id" class="relative flex h-6 items-center">
                <span class="bg-default absolute -left-[26px] size-2.5 rounded-full border-2" :style="{ borderColor: lineColor(leg.color) }" />
                <UButton :label="stop.name" color="neutral" variant="link" size="xs" class="text-default p-0" @click="emit('station', stop.id)" />
              </li>
            </ul>
          </template>
        </UCollapsible>
        <p v-else class="text-muted mt-1 text-xs tabular-nums">{{ rideSummary(leg) }}</p>
      </template>
      <template v-else>
        <span class="border-accented absolute top-5 -bottom-1 left-[6px] border-l-2 border-dotted" />
        <UIcon name="i-lucide-footprints" class="text-muted absolute top-0.5 left-0 size-3.5" />
        <p class="text-default text-xs leading-5">
          Walk to <span class="font-semibold">{{ leg.to.name }}</span>
          <span class="text-muted tabular-nums"> · {{ Math.round(leg.minutes) }} min</span>
        </p>
      </template>
    </li>
    <li class="relative pl-7">
      <span class="absolute top-0.5 left-0 size-3.5 rounded-full bg-(--ui-text-highlighted)" />
      <UButton
        :label="route.to.name"
        color="neutral"
        variant="link"
        class="text-highlighted p-0 text-sm leading-5 font-semibold"
        @click="emit('station', route.to.id)" />
    </li>
  </ol>
</template>

<script setup lang="ts">
  import type { RouteInfo } from '@railtime/network/facts.types';
  import type { StationId } from '@railtime/schema/network.types';
  import { ref, watch } from 'vue';
  import { rideSummary } from '~/features/explorer/route/route.utils';
  import { lineColor } from '~/utils/format.utils';

  const props = defineProps<{
    /** The way. */
    route: RouteInfo;
  }>();
  const emit = defineEmits<{ station: [station: StationId] }>();

  // The rides whose stops are listed; another way starts with them folded.
  const unfolded = ref(new Set<number>());
  watch(
    () => props.route,
    () => (unfolded.value = new Set()),
  );
  const toggle = (position: number) => {
    const next = new Set(unfolded.value);
    if (next.has(position)) next.delete(position);
    else next.add(position);
    unfolded.value = next;
  };
</script>
