<template>
  <div ref="explorer" class="bg-page h-dvh w-full">
    <UDashboardGroup storageKey="railtime-explorer" unit="px" class="relative h-full flex-col">
      <SiteHeader v-if="!mapOnly" wide>
        <template #leading>
          <UDashboardSidebarCollapse color="neutral" variant="ghost" />
          <UDashboardSidebarToggle color="neutral" variant="ghost" />
        </template>
        <template #context>
          <CitySelect :city @city="emit('city', $event)" />
        </template>
      </SiteHeader>

      <div class="flex min-h-0 flex-1">
        <!-- The panel: a rail of icons when collapsed; on a phone, a drawer the header's button opens. -->
        <UDashboardSidebar
          v-if="!mapOnly"
          v-model:open="drawerOpen"
          v-model:collapsed="collapsed"
          mode="drawer"
          collapsible
          resizable
          :defaultSize="420"
          :minSize="360"
          :maxSize="560"
          :collapsedSize="64"
          :toggle="false"
          :autoClose="false"
          :ui="{ root: 'bg-default min-h-0', body: 'gap-0 p-0 sm:p-0', content: 'max-h-[80dvh]' }">
          <template #default="{ collapsed: railOnly }">
            <div class="flex min-h-0 flex-1 max-lg:flex-col">
              <!-- The rail, always there: each section an icon with its name; the open one's folds the panel. On a phone, a row atop the drawer. -->
              <nav class="border-default flex shrink-0 gap-1 p-1.5 lg:w-16 lg:flex-col lg:items-center lg:border-r max-lg:border-b" aria-label="Panel">
                <UButton
                  v-for="entry in tabs"
                  :key="entry.id"
                  :icon="TAB_ICONS[entry.id]"
                  :label="entry.label"
                  :color="tab === entry.id && !railOnly ? 'primary' : 'neutral'"
                  :variant="tab === entry.id && !railOnly ? 'soft' : 'ghost'"
                  :aria-pressed="tab === entry.id && !railOnly"
                  class="flex-col gap-1 px-1 py-2 text-[11px] font-semibold max-lg:flex-1 lg:w-14"
                  :ui="{ leadingIcon: 'size-5' }"
                  @click="pickSection(entry.id, railOnly)" />
              </nav>
              <div v-if="!railOnly" class="flex min-h-0 min-w-0 flex-1 flex-col">
                <DateBlock :mode :time :planName="chosenPlan?.name" :stepActive="mode === 'history' && step !== null" />

                <div v-if="mode === 'history'" class="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
                  <StepCard :step :revealed />
                  <UpNext :changes :from="(time?.cursor ?? 0) + (step ? 1 : 0)" @select="jumpTo" />
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
                  <h2 class="text-highlighted flex items-baseline gap-2 px-4 pt-3 pb-2 text-sm font-bold">
                    {{ tabLabel }}
                    <span class="text-muted text-xs font-medium tabular-nums">{{ tabs.find(entry => entry.id === tab)?.count }}</span>
                  </h2>
                  <div class="min-h-0 flex-1 overflow-auto">
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
            </div>
          </template>
        </UDashboardSidebar>

        <UDashboardPanel :ui="{ root: 'min-h-0' }">
          <div class="relative min-h-0 flex-1">
            <!-- MapLibre sets `position: relative` on its container, unlayered, so it beats Tailwind's `absolute`: the wrapper positions, the container fills it. -->
            <div class="absolute inset-0">
              <div ref="mapElement" class="h-full w-full" />
            </div>
            <div class="absolute top-4 left-4 flex flex-col items-start gap-2">
              <!-- With the panel folded, the date and the counts stay on the map. -->
              <DateBlock v-if="collapsed && !mapOnly" compact class="max-lg:hidden" :mode :time :planName="chosenPlan?.name" :stepActive="step !== null" />
              <PlanLegend v-if="plan && mode === 'explore' && time?.future" :built="!planOnly" />
            </div>
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
            <!-- The timeline is asked for, not shown: the map opens on the network as it is. -->
            <UButton
              v-if="!mapOnly && !dockShown"
              :icon="planOnly ? 'i-lucide-play' : 'i-lucide-history'"
              :label="planOnly ? 'Play the plan' : 'History'"
              color="neutral"
              variant="outline"
              size="lg"
              class="bg-default shadow-soft absolute bottom-4 left-4 font-semibold"
              @click="openTimeline" />
            <!-- The map's credits stay on it with the dock gone: its licence asks for them. -->
            <MapCredits v-if="mapOnly || !dockShown" :credits class="bg-default/80 absolute right-0 bottom-0 max-w-[60%] rounded-tl-md px-2 py-1 text-right" />
            <!-- The same wrapper as the map's: MapLibre makes the minimap's container relative too. -->
            <div
              v-show="mode === 'history' && camera !== 'overview'"
              class="border-default shadow-soft absolute right-4 bottom-4 hidden h-32 w-50 overflow-hidden rounded-lg border sm:block">
              <div ref="minimapElement" class="h-full w-full" aria-label="Overview of the whole city" />
            </div>
          </div>

          <div v-show="!mapOnly && dockShown" class="border-default bg-default flex flex-col gap-1.5 border-t px-5 pt-3 pb-2 max-sm:px-3 max-sm:pb-4">
            <!-- Below the panel's width it is a drawer: the date stays in sight while playing. -->
            <DateBlock
              v-if="mode === 'history'"
              class="-mx-5 -mt-3 lg:hidden max-sm:-mx-3"
              :mode
              :time
              :planName="chosenPlan?.name"
              :stepActive="step !== null" />
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
                @future="showFuture"
                @close="closeTimeline" />
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
        </UDashboardPanel>
      </div>
    </UDashboardGroup>
  </div>
</template>

<script setup lang="ts">
  import { useRoute, useRouter } from '#imports';
  import type { CameraMode, RoutePreference, RouteStop } from '@railtime/renderer/transitMap.types';
  import type { Network } from '@railtime/schema/network.types';
  import { isPlanOnly } from '@railtime/schema/plan.utils';
  import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

  import { useTransitMap } from '~/features/explorer/transitMap.composable';
  import { DEFAULT_SPEED } from '~/features/explorer/explorer.constants';
  import { formatExplorerQuery, parseExplorerQuery } from '~/features/explorer/explorerUrl.utils';
  import type { TimelineTarget } from '~/features/explorer/timeline.types';

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

  /** The panel folded to a rail of icons; the choice is kept in a cookie, as its width is. */
  const collapsed = ref(false);
  /** Below the panel's width it is a drawer: whether it is open. */
  const drawerOpen = ref(false);
  /** Each tab's icon, on the rail. */
  const TAB_ICONS = { lines: 'i-lucide-list', changes: 'i-lucide-history', route: 'i-lucide-route', plans: 'i-lucide-drafting-compass' };
  /**
   * A section picked on the rail: the panel opens on it, over a station's or a line's view; the open
   * section's own icon folds the panel, as an editor's activity bar does.
   */
  const pickSection = (id: (typeof tab)['value'], folded: boolean) => {
    const showing = tab.value === id && !station.value && !openLine.value;
    if (showing && !folded) {
      collapsed.value = true;
      return;
    }
    tab.value = id;
    closeStation();
    openLine.value = null;
    collapsed.value = false;
  };
  /** Brings the panel into sight, for what was picked on the map: unfolds it, or on a phone opens its drawer. */
  const revealPanel = () => {
    if (window.matchMedia('(width < 64rem)').matches) drawerOpen.value = true;
    else collapsed.value = false;
  };

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

  // A station picked on the map opens its view in the panel, wherever the panel is.
  watch(
    () => station.value?.id,
    picked => {
      if (picked) revealPanel();
    },
  );

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

  /**
   * The timeline under the map: closed until asked for, so the page opens on the network as it is.
   * A date away from that (a link's, a change picked in the panel) opens it, so the way back is in sight.
   */
  const dockOpen = ref(false);
  const dockShown = computed(() => dockOpen.value || mode.value === 'history');
  /** The network as it is: today, or with a plan its future built. */
  const atRest = computed(() => {
    const now = time.value;
    if (!now) return true;
    return props.plan ? now.future : now.cursor === now.todayCursor && !now.future;
  });
  watch(atRest, rest => {
    if (!rest) dockOpen.value = true;
  });
  /** A network never built has no years to slide through: its button plays the plan. */
  const openTimeline = () => {
    if (planOnly) playHistory();
    else dockOpen.value = true;
  };
  const closeTimeline = () => {
    dockOpen.value = false;
    showFuture();
  };

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
