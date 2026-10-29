<template>
  <div ref="explorer" class="explorer bg-page h-full w-full" :class="{ 'map-only': mapOnly }">
    <aside v-show="!mapOnly" class="explorer-panel border-default bg-default flex min-h-0 flex-col sm:border-r max-sm:border-t">
      <PanelHeader :city @city="emit('city', $event)" />
      <DateBlock :mode :time :planName="chosenPlan?.name" :stepActive="mode === 'history' && step !== null" />

      <!-- On a phone the panel is a sheet: the date always, the rest when opened. -->
      <button
        v-if="mode === 'explore' && !station"
        type="button"
        class="border-muted text-muted flex items-center justify-center gap-1.5 border-b py-1.5 text-xs font-semibold sm:hidden"
        :aria-expanded="sheetOpen"
        @click="sheetOpen = !sheetOpen">
        {{ sheetOpen ? 'Hide' : tabs.map(entry => entry.label).join(' · ') }}
        <UIcon :name="sheetOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'" class="size-3.5" />
      </button>

      <div class="explorer-sheet flex min-h-0 flex-1 flex-col" :class="{ open: sheetOpen || station || mode === 'history' }">
        <div v-if="mode === 'history'" class="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
          <StepCard :step :revealed />
          <!-- On a phone the map needs the room: the step card alone. -->
          <UpNext class="max-sm:hidden" :changes :from="(time?.cursor ?? 0) + (step ? 1 : 0)" @select="jumpTo" />
        </div>
        <StationView
          v-else-if="station"
          class="min-h-0 flex-1 overflow-auto"
          :station
          :backLabel="lineDetails?.name ?? tabLabel"
          :date="shownDate"
          @close="closeStation"
          @select="openStation"
          @routeFrom="routeFromStation('from')"
          @routeTo="routeFromStation('to')" />
        <LineView
          v-else-if="lineDetails"
          class="min-h-0 flex-1 overflow-auto"
          :line="lineDetails"
          :changes="lineChanges"
          :time
          :backLabel="tabLabel"
          @close="openLine = null"
          @station="openStation"
          @change="map?.showChange($event)" />
        <template v-else>
          <!-- The route tab has searches of its own. -->
          <div v-if="tab !== 'route'" class="px-4 pt-3">
            <StationSearch :stations @select="openStation" />
          </div>
          <div class="border-muted flex gap-1 border-b px-4 pt-2.5" role="tablist" aria-label="Panel">
            <button
              v-for="entry in tabs"
              :key="entry.id"
              type="button"
              role="tab"
              :aria-selected="tab === entry.id"
              class="-mb-px flex items-baseline gap-1.5 border-b-2 px-2.5 pt-2 pb-2.5 text-sm font-semibold transition-colors duration-150"
              :class="tab === entry.id ? 'border-primary text-highlighted' : 'text-muted hover:text-highlighted border-transparent'"
              @click="tab = entry.id">
              {{ entry.label }}
              <span class="text-xs font-medium tabular-nums">{{ entry.count }}</span>
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-auto" role="tabpanel">
            <LinesTab v-if="tab === 'lines'" :lines :visible :date="shownDate" @change="setVisible" @open="openLine = $event" />
            <ChangesTab v-else-if="tab === 'changes'" :changes :time @select="map?.showChange($event)" />
            <RouteTab
              v-else-if="tab === 'route'"
              :stations
              :ends="routeEnds"
              :preference="routePreference"
              :route="foundRoute"
              @from="routeEnds.from = $event"
              @to="routeEnds.to = $event"
              @swap="routeEnds = { from: routeEnds.to, to: routeEnds.from }"
              @preference="routePreference = $event"
              @station="openStation" />
            <PlansTab v-else :network :plan @choose="choosePlan" />
          </div>
        </template>
      </div>
    </aside>

    <div class="explorer-map relative min-h-0">
      <!-- MapLibre sets `position: relative` on its container, unlayered, so it beats Tailwind's `absolute`: the wrapper positions, the container fills it. -->
      <div class="absolute inset-0">
        <div ref="mapElement" class="h-full w-full" />
      </div>
      <PlanLegend v-if="plan && mode === 'explore' && time?.future" :built="!planOnly" class="absolute top-4 left-4" />
      <div class="absolute top-4 right-4 flex flex-col gap-2">
        <UTooltip :text="mapOnly ? 'Show panels (Esc)' : 'Map only'">
          <UButton
            :icon="mapOnly ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
            color="neutral"
            variant="outline"
            class="bg-default shadow-soft"
            :aria-label="mapOnly ? 'Show panels' : 'Map only'"
            :aria-pressed="mapOnly"
            @click="toggleMapOnly" />
        </UTooltip>
        <UTooltip :text="stationNames ? 'Hide station names' : 'Show station names'">
          <UButton
            icon="i-lucide-type"
            :color="stationNames ? 'neutral' : 'primary'"
            :variant="stationNames ? 'outline' : 'soft'"
            class="shadow-soft"
            :class="{ 'bg-default': stationNames }"
            :aria-label="stationNames ? 'Hide station names' : 'Show station names'"
            :aria-pressed="!stationNames"
            @click="setStationNames(!stationNames)" />
        </UTooltip>
      </div>
      <!-- The map's credits stay on it with the panels gone: its licence asks for them. -->
      <MapCredits v-if="mapOnly" :credits class="bg-default/80 absolute right-0 bottom-0 rounded-tl-md px-2 py-1" />
      <!-- The same wrapper as the map's: MapLibre makes the minimap's container relative too. -->
      <div
        v-show="mode === 'history' && camera !== 'overview'"
        class="border-default shadow-soft absolute right-4 bottom-4 hidden h-32 w-50 overflow-hidden rounded-lg border sm:block">
        <div ref="minimapElement" class="h-full w-full" aria-label="Overview of the whole city" />
      </div>
    </div>

    <div v-show="!mapOnly" class="explorer-dock border-default bg-default flex flex-col gap-1.5 border-t px-5 pt-3 pb-2 max-sm:px-3 max-sm:pb-4">
      <div class="flex items-center gap-2">
        <ExploreDock
          v-if="mode === 'explore'"
          class="min-w-0 flex-1"
          :time
          :changes
          :range
          :isToday="!time || (time.cursor === time.todayCursor && !time.future)"
          :isFuture="time?.future === true"
          :hasPlan="!!plan"
          :hasHistory="!planOnly"
          @play="playHistory"
          @pick="pick"
          @seek="showDate"
          @future="showFuture" />
        <PlaybackDock
          v-else
          class="min-w-0 flex-1"
          :time
          :changes
          :range
          :playing="time?.playing ?? false"
          :speed
          :camera
          @play="map?.play()"
          @pause="map?.pause()"
          @skip="map?.skip()"
          @pick="pick"
          @speed="setSpeed"
          @camera="setCamera"
          @exit="exitHistory" />
        <!-- On a phone the credits fold into a button, still a tap away. -->
        <UPopover class="sm:hidden">
          <UButton icon="i-lucide-info" color="neutral" variant="ghost" aria-label="Credits" />
          <template #content>
            <MapCredits :credits class="max-w-72 p-3" />
          </template>
        </UPopover>
      </div>
      <MapCredits :credits class="text-right max-sm:hidden" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useRoute, useRouter } from '#imports';
  import type { CameraMode, RoutePreference, RouteStop } from '@railtime/renderer/transitMap.types';
  import type { Network } from '@railtime/schema/network.types';
  import { isPlanOnly } from '@railtime/schema/plan.utils';
  import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

  import { useTransitMap } from '~/composables/transitMap.composable';
  import { DEFAULT_SPEED } from '~/utils/explorer.constants';
  import { formatExplorerQuery, parseExplorerQuery } from '~/utils/explorerUrl.utils';
  import type { TimelineTarget } from '~/utils/timeline.types';

  import ChangesTab from './ChangesTab.vue';
  import DateBlock from './DateBlock.vue';
  import ExploreDock from './ExploreDock.vue';
  import LinesTab from './LinesTab.vue';
  import LineView from './LineView.vue';
  import MapCredits from './MapCredits.vue';
  import PanelHeader from './PanelHeader.vue';
  import PlanLegend from './PlanLegend.vue';
  import PlansTab from './PlansTab.vue';
  import PlaybackDock from './PlaybackDock.vue';
  import RouteTab from './RouteTab.vue';
  import StationSearch from './StationSearch.vue';
  import StationView from './StationView.vue';
  import StepCard from './StepCard.vue';
  import UpNext from './UpNext.vue';

  const props = defineProps<{ network: Network; city: string; plan?: string }>();
  const emit = defineEmits<{ city: [city: string]; plan: [plan: string | undefined] }>();

  const explorer = useTemplateRef<HTMLElement>('explorer');
  const mapElement = useTemplateRef<HTMLElement>('mapElement');
  const minimapElement = useTemplateRef<HTMLElement>('minimapElement');
  const route = useRoute();
  const router = useRouter();
  // The address says what to open on: a day, a view, a station's panel.
  const opening = parseExplorerQuery(route.query);
  const { map, time, step, revealed, station, lines, changes, view } = useTransitMap({
    container: mapElement,
    minimapContainer: minimapElement,
    network: props.network,
    ...(opening.view ? { view: opening.view } : {}),
    ...(props.plan ? { plan: props.plan } : {}),
  });

  const planOnly = isPlanOnly(props.network);
  const planCount = Object.keys(props.network.plans ?? {}).length;
  const chosenPlan = computed(() => (props.plan ? props.network.plans?.[props.plan] : undefined));
  const choosePlan = (id: string | undefined) => {
    if (id !== props.plan) emit('plan', id);
  };

  /** `explore`: the map as it is, or was via the year slider. `history`: the playback. */
  const mode = ref<'explore' | 'history'>('explore');
  const speed = ref(DEFAULT_SPEED);
  const camera = ref<CameraMode>('follow');
  const visible = ref(new Set([...Object.keys(props.network.lines), ...Object.keys(chosenPlan.value?.lines ?? {})]));
  const range = computed(() => map.value?.range ?? { start: 0, end: Date.now(), today: Date.now() });
  const credits = computed(() => map.value?.credits ?? []);

  /** The panel's tabs. A plan opens on Plans, where it was picked; a city without plans has only Lines. */
  const tab = ref<'lines' | 'changes' | 'route' | 'plans'>(props.plan ? 'plans' : 'lines');
  const tabs = computed(() => [
    { id: 'lines' as const, label: 'Lines', count: `${lines.value.filter(line => visible.value.has(line.id)).length}/${lines.value.length}` },
    { id: 'changes' as const, label: 'Changes', count: String(changes.value.length) },
    { id: 'route' as const, label: 'Route', count: '' },
    ...(planCount > 0 ? [{ id: 'plans' as const, label: 'Plans', count: String(planCount) }] : []),
  ]);
  const tabLabel = computed(() => tabs.value.find(entry => entry.id === tab.value)?.label ?? 'Lines');
  /** On a phone, whether the sheet shows the tabs. */
  const sheetOpen = ref(false);

  /** The line whose panel is open, if any: its stops and history, on the date shown. */
  const openLine = ref<string | null>(null);
  const lineDetails = computed(() => {
    // Read for the date shown: a line's stops change with it.
    const shown = time.value?.cursor;
    return openLine.value && map.value && shown !== undefined ? map.value.getLineDetails(openLine.value) : null;
  });
  const lineChanges = computed(() => {
    const wanted = new Set(lineDetails.value?.changes ?? []);
    return changes.value.filter(change => wanted.has(change.index));
  });
  /** The stations on the map on the date shown, for the search; none while playing, when it is hidden. */
  const stations = computed(() => (time.value && !time.value.playing && map.value ? map.value.getStations() : []));

  /** A route between two stations, on the date shown: drawn on the map while its tab is open. */
  const routeEnds = ref<{ from: RouteStop | null; to: RouteStop | null }>({ from: null, to: null });
  const routePreference = ref<RoutePreference>('fastest');
  const foundRoute = computed(() => {
    const { from, to } = routeEnds.value;
    // Found again for the date shown: lines open and close.
    const shown = time.value?.cursor;
    return from && to && map.value && shown !== undefined ? map.value.findRoute(from.id, to.id, routePreference.value) : null;
  });
  watch([foundRoute, tab, mode], () => map.value?.showRoute(tab.value === 'route' && mode.value === 'explore' ? foundRoute.value : null));
  /** Starts or ends a route at the station whose panel is open, and goes to the route. */
  const routeFromStation = (end: 'from' | 'to') => {
    if (!station.value) return;
    routeEnds.value = { ...routeEnds.value, [end]: { id: station.value.id, name: station.value.name } };
    closeStation();
    tab.value = 'route';
  };

  /** The date shown, for what had opened by then; `null` in a plan's future. */
  const shownDate = computed(() => (!time.value || time.value.future ? null : time.value.time));

  watch(map, transitMap => {
    if (!transitMap) return;
    const { start, end } = transitMap.range;
    if (opening.date !== undefined) transitMap.setDate(Math.min(Math.max(opening.date, start), end));
    // A plan opens on its future, built.
    else if (props.plan) transitMap.showFuture();
    // A station the network does not have is a stale link: open without it.
    if (opening.station && (props.network.stations[opening.station] || chosenPlan.value?.stations?.[opening.station])) {
      station.value = transitMap.getStationInfo(opening.station);
      transitMap.selectStation(opening.station);
    }
  });

  // While exploring, the address follows the map, so it can be shared; playback leaves it alone.
  const query = computed(() => {
    // No date is the default: today, or with a plan its future, which has no date.
    const now = time.value;
    const dated = now !== null && !now.future && (props.plan !== undefined || now.cursor !== now.todayCursor);
    return formatExplorerQuery({
      ...(dated ? { date: now.time } : {}),
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

  /** Opens a station's view and rings it, as a click on it would. */
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
    // With a plan, the future plays from today; without, the history from the start.
    map.value?.setDate(props.plan ? range.value.today : range.value.start);
    map.value?.play();
  };

  const exitHistory = () => {
    mode.value = 'explore';
    showFuture();
    map.value?.fitNetwork();
  };

  /** The network as it ends: with a plan, its future built; without, today. */
  const showFuture = () => {
    if (props.plan) map.value?.showFuture();
    else map.value?.setDate(range.value.end);
  };

  /** Shows what the timeline was picked at; in playback, plays on from there if it was playing. */
  const pick = (target: TimelineTarget) => {
    const transitMap = map.value;
    if (!transitMap) return;
    const wasPlaying = mode.value === 'history' && time.value?.playing === true;
    if (target.kind === 'future') showFuture();
    else if (target.kind === 'change') transitMap.showChange(target.index);
    else transitMap.setDate(target.time);
    if (wasPlaying && target.kind !== 'future') transitMap.play();
  };

  /** Jumps playback to a change and plays it now. */
  const jumpTo = (index: number) => map.value?.playFrom(index);

  const setSpeed = (value: number) => {
    speed.value = value;
    map.value?.setSpeed(value);
  };

  const setCamera = (value: CameraMode) => {
    camera.value = value;
    map.value?.setCameraMode(value);
  };

  /** Whether the map names its stations; the choice is remembered in this browser. */
  const STATION_NAMES_KEY = 'railtime:station-names';
  const stationNames = ref(true);
  const setStationNames = (shown: boolean) => {
    stationNames.value = shown;
    map.value?.setStationLabels(shown);
    try {
      localStorage.setItem(STATION_NAMES_KEY, shown ? 'on' : 'off');
    } catch {
      // Storage blocked (a private window): the choice lasts the visit.
    }
  };
  watch(map, transitMap => {
    try {
      if (localStorage.getItem(STATION_NAMES_KEY) === 'off') stationNames.value = false;
    } catch {
      // Storage blocked: names shown.
    }
    transitMap?.setStationLabels(stationNames.value);
  });

  /** Only the map: the panel and the dock hidden, the page full screen where the browser lets it. */
  const mapOnly = ref(false);
  const toggleMapOnly = async () => {
    mapOnly.value = !mapOnly.value;
    // Not every browser has full screen (an iPhone's Safari): there the panels still hide.
    if (mapOnly.value) await explorer.value?.requestFullscreen?.().catch(() => undefined);
    else if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  };
  // Leaving full screen (Esc, or the browser's own control) brings the panels back.
  const onFullscreenChange = () => {
    if (!document.fullscreenElement) mapOnly.value = false;
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && mapOnly.value) void toggleMapOnly();
  };
  onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeydown);
  });
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('keydown', onKeydown);
  });
</script>

<style scoped>
  /* The panel down the side, the map beside it, the dock under the map. */
  .explorer {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas:
      'panel map'
      'panel dock';
  }
  .explorer-panel {
    grid-area: panel;
  }
  .explorer-map {
    grid-area: map;
  }
  .explorer-dock {
    grid-area: dock;
  }

  /* Only the map. */
  .explorer.map-only {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    grid-template-areas: 'map';
  }

  /* A phone: the map, the panel as a sheet under it, then the dock. */
  @media (width < 40rem) {
    .explorer {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto auto;
      grid-template-areas:
        'map'
        'panel'
        'dock';
    }
    .explorer-sheet {
      display: none;
      max-height: 45dvh;
    }
    .explorer-sheet.open {
      display: flex;
    }
  }
</style>
