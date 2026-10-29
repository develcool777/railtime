<template>
  <div class="relative h-full w-full overflow-hidden">
    <!-- MapLibre sets `position: relative` on its container, unlayered, so it beats Tailwind's `absolute`: the wrapper positions, the container fills it. -->
    <div class="absolute inset-0">
      <div ref="mapElement" class="explorer-map h-full w-full" />
    </div>

    <div class="absolute top-4 left-4 flex max-w-[calc(100%-32px)] flex-col gap-3 sm:top-5 sm:left-6">
      <div v-if="mode === 'explore'" class="flex items-center gap-2">
        <UTooltip text="All cities">
          <UButton to="/" icon="i-lucide-layout-grid" color="neutral" variant="soft" aria-label="All cities" />
        </UTooltip>
        <USelect :modelValue="city" :items="CITIES" icon="i-lucide-map-pin" class="w-52" aria-label="City" @update:modelValue="emit('city', String($event))" />
        <USelect
          v-if="planItems.length > 1"
          :modelValue="plan ?? NO_PLAN"
          :items="planItems"
          icon="i-lucide-route"
          class="w-48"
          aria-label="Future plan"
          @update:modelValue="choosePlan(String($event))" />
        <UPopover v-if="chosenPlan">
          <UButton icon="i-lucide-info" color="neutral" variant="soft" aria-label="About this plan" />
          <template #content>
            <PlanNote :plan="chosenPlan" />
          </template>
        </UPopover>
      </div>
      <ExplorerHud :mode :time :stepActive="mode === 'history' && step !== null" />
      <StepCard v-if="mode === 'history'" :step :revealed />
      <StationPanel v-if="station" :station @close="closeStation" @select="openStation" />
    </div>

    <div class="absolute top-4 right-4 flex flex-col items-end gap-3 sm:top-5 sm:right-5">
      <div
        v-show="mode === 'history'"
        ref="minimapElement"
        class="hidden h-44 w-60 overflow-hidden rounded-xl border border-default shadow-lg sm:block"
        aria-label="Overview of the whole city" />
      <LinePanel class="hidden sm:block" :lines :visible @change="setVisible" />
      <!-- On a phone the panel would cover the map: a button opens it. -->
      <UPopover class="sm:hidden">
        <UButton icon="i-lucide-layers" color="neutral" variant="soft" aria-label="Lines" />
        <template #content>
          <LinePanel :lines :visible @change="setVisible" />
        </template>
      </UPopover>
    </div>

    <div class="absolute bottom-6 left-1/2 w-[min(880px,calc(100%-32px))] -translate-x-1/2">
      <ExploreBar
        v-if="mode === 'explore'"
        :time="time?.time ?? range.end"
        :range
        :isToday="!time || time.cursor === time.todayCursor"
        @playHistory="playHistory"
        @seek="showDate" />
      <PlaybackBar
        v-else
        :time="time?.time ?? range.start"
        :range
        :playing="time?.playing ?? false"
        :speed
        :camera
        @play="map?.play()"
        @pause="map?.pause()"
        @skip="map?.skip()"
        @seek="seek"
        @speed="setSpeed"
        @camera="setCamera"
        @exit="exitHistory" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useRoute, useRouter } from '#imports';
  import type { CameraMode } from '@railtime/renderer/transitMap.types';
  import type { Network } from '@railtime/schema/network.types';
  import { computed, ref, useTemplateRef, watch } from 'vue';

  import { useTransitMap } from '~/composables/transitMap.composable';
  import { CITIES, DEFAULT_SPEED } from '~/utils/explorer.constants';
  import { formatExplorerQuery, parseExplorerQuery } from '~/utils/explorerUrl.utils';

  import ExploreBar from './ExploreBar.vue';
  import ExplorerHud from './ExplorerHud.vue';
  import LinePanel from './LinePanel.vue';
  import PlanNote from './PlanNote.vue';
  import PlaybackBar from './PlaybackBar.vue';
  import StationPanel from './StationPanel.vue';
  import StepCard from './StepCard.vue';

  const props = defineProps<{ network: Network; city: string; plan?: string }>();
  const emit = defineEmits<{ city: [city: string]; plan: [plan: string | undefined] }>();

  const mapElement = useTemplateRef<HTMLElement>('mapElement');
  const minimapElement = useTemplateRef<HTMLElement>('minimapElement');
  const route = useRoute();
  const router = useRouter();
  // The address says what to open on: a day, a view, a station's panel.
  const opening = parseExplorerQuery(route.query);
  const { map, time, step, revealed, station, lines, view } = useTransitMap({
    container: mapElement,
    minimapContainer: minimapElement,
    network: props.network,
    ...(opening.view ? { view: opening.view } : {}),
    ...(props.plan ? { plan: props.plan } : {}),
  });

  /** The select's value for the network as it is. */
  const NO_PLAN = 'none';
  const planItems = computed(() => [
    { label: 'No plans', value: NO_PLAN },
    ...Object.entries(props.network.plans ?? {}).map(([id, plan]) => ({ label: plan.name, value: id })),
  ]);
  const chosenPlan = computed(() => (props.plan ? props.network.plans?.[props.plan] : undefined));
  const choosePlan = (id: string) => emit('plan', id === NO_PLAN ? undefined : id);

  /** `explore`: the map as it is, or was via the year slider. `history`: the playback. */
  const mode = ref<'explore' | 'history'>('explore');
  const speed = ref(DEFAULT_SPEED);
  const camera = ref<CameraMode>('follow');
  const visible = ref(new Set([...Object.keys(props.network.lines), ...Object.keys(chosenPlan.value?.lines ?? {})]));
  const range = computed(() => map.value?.range ?? { start: 0, end: Date.now(), today: Date.now() });

  watch(map, transitMap => {
    if (!transitMap) return;
    const { start, end } = transitMap.range;
    if (opening.date !== undefined) transitMap.setDate(Math.min(Math.max(opening.date, start), end));
    // A station the network does not have is a stale link: open without it.
    if (opening.station && props.network.stations[opening.station]) {
      station.value = transitMap.getStationInfo(opening.station);
      transitMap.selectStation(opening.station);
    }
  });

  // While exploring, the address follows the map, so it can be shared; playback leaves it alone.
  const query = computed(() => {
    const isToday = !time.value || time.value.cursor === time.value.todayCursor;
    return formatExplorerQuery({
      ...(time.value && !isToday ? { date: time.value.time } : {}),
      ...(view.value ? { view: view.value } : {}),
      ...(station.value ? { station: station.value.id } : {}),
      ...(props.plan ? { plan: props.plan } : {}),
    });
  });
  watch(query, next => {
    if (mode.value !== 'explore') return;
    if (JSON.stringify(next) !== JSON.stringify(route.query)) void router.replace({ query: next });
  });

  const setVisible = (next: Set<string>) => {
    visible.value = next;
    map.value?.setVisibleLines([...next]);
  };

  const closeStation = () => {
    station.value = null;
    map.value?.selectStation(null);
  };

  /** Opens a station's panel and rings it, as a click on it would. */
  const openStation = (id: string) => {
    if (!map.value) return;
    station.value = map.value.getStationInfo(id);
    map.value.selectStation(id);
  };

  const showDate = (date: number) => map.value?.setDate(date);

  const playHistory = () => {
    closeStation();
    mode.value = 'history';
    map.value?.setSpeed(speed.value);
    map.value?.setCameraMode(camera.value);
    map.value?.setDate(range.value.start);
    map.value?.play();
  };

  const exitHistory = () => {
    mode.value = 'explore';
    map.value?.setDate(range.value.end);
    map.value?.fitNetwork();
  };

  const seek = (date: number) => {
    const wasPlaying = time.value?.playing;
    map.value?.setDate(date);
    if (wasPlaying) map.value?.play();
  };

  const setSpeed = (value: number) => {
    speed.value = value;
    map.value?.setSpeed(value);
  };

  const setCamera = (value: CameraMode) => {
    camera.value = value;
    map.value?.setCameraMode(value);
  };
</script>
