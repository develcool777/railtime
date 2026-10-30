<template>
  <div ref="explorer" class="bg-page flex h-dvh w-full flex-col">
    <SiteHeader v-if="!mapOnly" wide>
      <template #context>
        <CitySelect v-model:open="cityMenuOpen" :city @city="emit('city', $event)" />
      </template>
      <template #center>
        <SearchButton @open="searchOpen = true" />
      </template>
      <UButton v-if="phone" icon="i-lucide-search" color="neutral" variant="ghost" square aria-label="Search" @click="searchOpen = true" />
    </SiteHeader>

    <div class="relative flex min-h-0 flex-1">
      <ExplorerRail v-if="!phone && !mapOnly" :sections :open="panelOpen ? railSection : null" :marks @pick="pickSection" />

      <!-- The map keeps its size: the panel slides over its left edge, which resizing it every frame would make stutter. -->
      <div class="relative min-w-0 flex-1 overflow-hidden">
        <!-- The panel: over the map's left, a column that folds and resizes; on a phone, a sheet over its foot. -->
        <section
          v-if="!mapOnly"
          class="bg-default flex flex-col"
          :class="
            phone
              ? 'absolute inset-x-0 bottom-0 z-20 overflow-hidden rounded-t-lg shadow-[0_-8px_30px_rgba(21,32,48,0.1)] transition-[height] duration-200 ease-out'
              : [
                  'border-default absolute inset-y-0 left-0 z-20 border-r',
                  resizing ? '' : 'transition-transform duration-200 ease-out',
                  panelOpen ? '' : '-translate-x-full',
                ]
          "
          :style="phone ? { height: sheet === 'full' ? 'calc(100% - 8px)' : `${SHEET_HEIGHTS[sheet]}px` } : { width: `${panelWidth}px` }"
          :inert="!phone && !panelOpen"
          aria-label="Panel">
          <ExplorerSheet v-if="phone" v-model:snap="sheet" :sections :open="sheet === 'peek' ? null : railSection" :marks @pick="pickSection" />
          <div v-show="!phone || sheet !== 'peek'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PanelTop
              :title="panelTop.title"
              :context="panelTop.context"
              :dots="panelTop.dots"
              :backLabel="panelTop.backLabel"
              :foldable="!phone"
              @back="goBack"
              @fold="panelOpen = false" />
            <div class="min-h-0 flex-1 overflow-y-auto">
              <StationView v-if="station" :station :directions="stationDirections" :date="shownDate" @select="walkTo" @line="pushLine" />
              <LineView v-else-if="lineDetails" :line="lineDetails" :changes="lineChanges" :stationColors @station="openStation" @change="showChange" />
              <StationsSection v-else-if="section === 'stations'" :stations @open="openStation" />
              <LinesSection v-else-if="section === 'lines'" :lines :visible :date="shownDate" @change="setVisible" @open="pushLine" />
              <ChangesSection v-else-if="section === 'changes'" :changes :current="currentChange" :playing="timeMode === 'playing'" @select="pickChange" />
              <RouteSection
                v-else-if="section === 'route'"
                :stations
                :ends="routeEnds"
                :preference="routePreference"
                :route="foundRoute"
                @from="routeEnds.from = $event"
                @to="routeEnds.to = $event"
                @swap="swapEnds"
                @preference="routePreference = $event"
                @station="openStation" />
              <ReachSection v-else-if="section === 'reach'" :stations :from="reachFrom" :reach="foundReach" @from="reachFrom = $event" @station="openStation" />
              <PlansSection v-else :network :plan :built="builtFacts" @choose="choosePlan" />
            </div>
          </div>
          <!-- Drag to resize; the width is kept in a cookie. -->
          <div
            v-if="!phone && panelOpen"
            class="hover:bg-brand-200 dark:hover:bg-brand-800 absolute top-0 -right-[3px] bottom-0 z-10 w-1.5 cursor-col-resize transition-colors duration-150"
            :class="{ 'bg-brand-200 dark:bg-brand-800': resizing }"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the panel"
            @pointerdown="startResize" />
        </section>

        <main class="absolute inset-0">
          <!-- MapLibre sets `position: relative` on its container, unlayered, so it beats Tailwind's `absolute`: the wrapper positions, the container fills it. -->
          <div class="absolute inset-0">
            <div ref="mapElement" class="h-full w-full" />
          </div>

          <PlanLegend
            v-if="planLegend && !mapOnly"
            class="absolute top-4 left-4 max-lg:top-3 max-lg:left-3"
            :class="{ 'transition-transform duration-200 ease-out': !resizing }"
            :style="{ transform: `translateX(${panelCover}px)` }"
            :name="planLegend.name"
            :color="planLegend.color" />

          <MapTools
            v-if="!mapOnly"
            class="absolute top-4 right-4 max-lg:top-3 max-lg:right-3"
            :stationNames
            @zoomIn="map?.zoomIn()"
            @zoomOut="map?.zoomOut()"
            @fit="map?.fitNetwork()"
            @stationNames="setStationNames"
            @mapOnly="toggleMapOnly" />
          <button
            v-else
            type="button"
            class="map-card text-highlighted absolute top-4 right-4 flex h-10 items-center gap-1.5 px-3 text-sm font-semibold"
            @click="toggleMapOnly">
            <UIcon name="i-lucide-minimize-2" class="size-4" />
            Exit map only
            <UKbd value="Esc" />
          </button>

          <!-- The time control, and above it while following playback the minimap; on a phone it rides above the sheet. -->
          <div
            v-show="!mapOnly && !(phone && sheet === 'full')"
            class="pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col gap-3"
            :class="[timeMode === 'rest' ? 'items-center' : 'items-start', resizing ? '' : 'transition-[left,width] duration-200 ease-out']"
            :style="{
              bottom: phone ? `${SHEET_HEIGHTS[sheet === 'full' ? 'half' : sheet] + 12}px` : '28px',
              // Centred on what the panel leaves of the map.
              left: `calc(50% + ${panelCover / 2}px)`,
              width: phone ? 'calc(100% - 24px)' : `min(960px, calc(100% - ${32 + panelCover}px))`,
            }">
            <!-- The same wrapper as the map's: MapLibre makes the minimap's container relative too. -->
            <div
              v-show="minimapShown"
              class="pointer-events-auto h-[124px] w-[200px] overflow-hidden rounded-lg border-[3px] border-white shadow-[0_8px_30px_rgba(21,32,48,0.1)] dark:border-(--ui-bg)">
              <div ref="minimapElement" class="h-full w-full" aria-label="Overview of the whole city" />
            </div>
            <TimeControl
              class="pointer-events-auto"
              :mode="timeMode"
              :phone
              :time
              :changes
              :range
              :step
              :speed
              :camera
              :plan="planSummary"
              :planOnly
              @open="openTimeline"
              @close="closeTimeline"
              @today="showToday"
              @future="showFuture"
              @play="play"
              @pause="map?.pause()"
              @skip="map?.skip()"
              @pick="pick"
              @speed="setSpeed"
              @camera="setCamera"
              @exit="exitHistory" />
          </div>

          <!-- The map's credits stay on it: its licence asks for them. On a phone they fold into a button. -->
          <MapCredits v-if="!phone" :credits class="absolute right-2 bottom-1 max-w-[40%] text-right leading-4" />
          <UPopover v-else-if="!mapOnly">
            <UButton
              icon="i-lucide-info"
              color="neutral"
              variant="ghost"
              size="sm"
              class="map-card absolute top-3 left-3"
              :class="{ 'top-14': planLegend }"
              aria-label="Credits" />
            <template #content>
              <MapCredits :credits class="max-w-72 p-3" />
            </template>
          </UPopover>
        </main>
      </div>
    </div>

    <ExplorerSearch v-model:open="searchOpen" :stations :lines :city @station="openStation" @line="pushLine" @city="emit('city', $event)" />
  </div>
</template>

<script setup lang="ts">
  import { useRoute } from '#imports';
  import type { Network } from '@railtime/schema/network.types';
  import { computed, ref, useTemplateRef, watch } from 'vue';

  import { useExplorerAddress } from '~/features/explorer/address/address.composable';
  import { parseExplorerQuery } from '~/features/explorer/address/address.utils';
  import { SHEET_HEIGHTS } from '~/features/explorer/explorer.constants';
  import type { Section, TimeMode } from '~/features/explorer/explorer.types';
  import { useExplorerLayout } from '~/features/explorer/layout.composable';
  import { useStationNames } from '~/features/explorer/map/stationNames.composable';
  import { useTransitMap } from '~/features/explorer/map/transitMap.composable';
  import { useExplorerPanel } from '~/features/explorer/panel/panel.composable';
  import { useExplorerPlan } from '~/features/explorer/plans/plan.composable';
  import { useReachFinder } from '~/features/explorer/reach/reach.composable';
  import { useRouteFinder } from '~/features/explorer/route/route.composable';
  import { useExplorerShortcuts } from '~/features/explorer/shortcuts.composable';
  import { useExplorerTime } from '~/features/explorer/time/time.composable';

  const props = defineProps<{ network: Network; city: string; plan?: string }>();
  const emit = defineEmits<{ city: [city: string]; plan: [plan: string | undefined] }>();

  const explorer = useTemplateRef<HTMLElement>('explorer');
  const mapElement = useTemplateRef<HTMLElement>('mapElement');
  const minimapElement = useTemplateRef<HTMLElement>('minimapElement');

  /** What the time control shows: driven by the time control, read by the panel and the layout too. */
  const timeMode = ref<TimeMode>('rest');
  const { phone, sheet, panelOpen, panelWidth, panelCover, resizing, startResize, revealPanel, togglePanel, mapOnly, toggleMapOnly, mapPadding } =
    useExplorerLayout(explorer);

  // The address says what to open on: a day, a view, a station's view.
  const opening = parseExplorerQuery(useRoute().query);
  const binding = useTransitMap({
    container: mapElement,
    minimapContainer: minimapElement,
    network: props.network,
    padding: () => mapPadding(timeMode.value),
    cover: () => panelCover.value,
    ...(opening.view ? { view: opening.view } : {}),
    ...(props.plan ? { plan: props.plan } : {}),
  });
  const { map, time, step, station, lines, changes } = binding;
  watch([timeMode, sheet, phone], () => map.value?.setPadding(mapPadding(timeMode.value)));
  watch(panelCover, left => map.value?.setCover({ left }));

  const { planOnly, planCount, chosenPlan, planSummary, planLegend, builtFacts, planMark, openingSection, choosePlan } = useExplorerPlan({
    network: props.network,
    plan: props.plan,
    time,
    timeMode,
    onChoose: id => emit('plan', id),
  });

  const {
    sections,
    section,
    railSection,
    lineDetails,
    lineChanges,
    stations,
    stationColors,
    stationDirections,
    visible,
    setVisible,
    currentChange,
    panelTop,
    shownDate,
    pickSection,
    openSection,
    goBack,
    hasPushedView,
    pushLine,
    openStation,
    walkTo,
    pickChange,
    showChange,
    followPlayback,
  } = useExplorerPanel({
    network: props.network,
    plan: props.plan,
    opening: openingSection,
    chosenPlan,
    planCount,
    binding,
    layout: { phone, panelOpen, revealPanel },
    timeMode,
  });

  const {
    speed,
    camera,
    range,
    openTimeline,
    closeTimeline,
    toggleTimeline,
    play,
    togglePlay,
    exitHistory,
    showFuture,
    showToday,
    pick,
    setSpeed,
    setCamera,
    stepTime,
  } = useExplorerTime({ binding, timeMode, plan: props.plan, planOnly, currentChange, onPlay: followPlayback });

  const { routeEnds, routePreference, foundRoute, swapEnds, routeMark } = useRouteFinder({ binding, section, timeMode });
  const { reachFrom, foundReach, reachMark } = useReachFinder({ binding, section, timeMode });

  // A dot on each section whose choice is in force while another is open: a plan shown, a route or a reach set.
  const marks = computed(() => {
    const shown: Partial<Record<Section, string>> = {};
    if (planMark) shown.plans = planMark;
    if (routeMark.value) shown.route = routeMark.value;
    if (reachMark.value) shown.reach = reachMark.value;
    return shown;
  });

  useExplorerAddress({ network: props.network, plan: props.plan, chosenPlan, binding, timeMode, opening });

  const { stationNames, setStationNames } = useStationNames(map);

  /** The lines the map brings forward: a line's own in its view; every line otherwise. A route shown fades them all itself. */
  const focusedLines = computed(() => {
    if (timeMode.value === 'playing' || station.value) return null;
    return lineDetails.value ? [lineDetails.value.id] : null;
  });
  watch(focusedLines, (next, previous) => {
    if (JSON.stringify(next) !== JSON.stringify(previous)) map.value?.focusLines(next);
  });

  const credits = computed(() => map.value?.credits ?? []);
  /** The minimap shows where the camera is while it follows playback, beside the map. */
  const minimapShown = computed(() => timeMode.value === 'playing' && camera.value === 'follow' && !phone.value);

  const searchOpen = ref(false);
  const cityMenuOpen = ref(false);

  useExplorerShortcuts({
    sections,
    openSection,
    openSearch: () => (searchOpen.value = true),
    togglePanel,
    toggleTimeline,
    togglePlay,
    stepTime,
    toggleStationNames: () => setStationNames(!stationNames.value),
    mapOnly,
    toggleMapOnly,
    hasPushedView,
    goBack,
  });
</script>
