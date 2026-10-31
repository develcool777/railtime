<template>
  <div ref="explorer" class="bg-page flex h-dvh w-full flex-col">
    <SiteHeader v-if="chrome.header" wide>
      <template #context>
        <CitySelect v-model:open="citiesOpen" :city @city="emit('city', $event)" />
      </template>
      <template #center>
        <!-- Opens the search, as ⌘K and / do. -->
        <UDashboardSearchButton label="Find a station or line…" color="neutral" class="w-full max-w-[420px]" @click="store.setDialog('search')" />
      </template>
      <UButton v-if="phone" icon="i-lucide-search" color="neutral" variant="ghost" square aria-label="Search" @click="store.setDialog('search')" />
    </SiteHeader>

    <div class="relative flex min-h-0 flex-1">
      <ExplorerRail v-if="chrome.rail" :sections :open="panelOpen ? railSection : null" :marks @pick="store.pickSection" />

      <!-- The map keeps its size: the panel slides over its left edge, which resizing it every frame would make stutter. -->
      <div class="relative min-w-0 flex-1 overflow-hidden">
        <!-- The panel: over the map's left, a column that folds and resizes; on a phone, a drawer over its foot. -->
        <ExplorerPanel
          v-if="chrome.panel"
          v-model:snap="sheet"
          :phone
          :open="panelOpen"
          :width="panelWidth"
          :resizing
          :sections
          :section="railSection"
          :marks
          @pick="store.pickSection"
          @resize="startResize">
          <PanelTop
            :title="panelTop.title"
            :context="panelTop.context"
            :dots="panelTop.dots"
            :backLabel="panelTop.backLabel"
            :foldable="!phone"
            @back="store.goBack"
            @fold="panelOpen = false" />
          <div class="min-h-0 flex-1 overflow-y-auto">
            <StationView v-if="station" :station :directions="stationDirections" :date="shownDate" @select="store.walkTo" @line="store.pushLine" />
            <LineView
              v-else-if="lineDetails"
              :line="lineDetails"
              :changes="lineChanges"
              :stationColors
              @station="store.pickStation"
              @change="store.pick({ kind: 'change', index: $event })" />
            <StationsSection v-else-if="section === 'stations'" :stations @open="store.pickStation" />
            <LinesSection v-else-if="section === 'lines'" :lines :visible :date="shownDate" @change="setVisible" @open="store.pushLine" />
            <ChangesSection v-else-if="section === 'changes'" :changes :current="currentChange" :playing="timeMode === 'playing'" @select="store.pickChange" />
            <RouteSection
              v-else-if="section === 'route'"
              :stations
              :ends="routeEnds"
              :preference="routePreference"
              :route="foundRoute"
              @from="routeEnds = { ...routeEnds, from: $event }"
              @to="routeEnds = { ...routeEnds, to: $event }"
              @swap="store.swapEnds"
              @preference="routePreference = $event"
              @station="store.pickStation" />
            <ReachSection
              v-else-if="section === 'reach'"
              :stations
              :from="reachFrom"
              :reach="foundReach"
              @from="reachFrom = $event"
              @station="store.pickStation" />
            <CoverageSection v-else-if="section === 'coverage'" :state="boundaryState" :coverage :history="coverageHistory" @year="store.showYear" />
            <InsightsSection
              v-else-if="section === 'insights'"
              :growth
              :hasHistory
              :records
              :year="shownYear"
              @year="store.showYear"
              @station="store.pickStation"
              @line="store.pushLine" />
            <PlansSection v-else :plans :planOnly :plan :built="builtFacts" @choose="choosePlan" />
          </div>
        </ExplorerPanel>

        <main class="absolute inset-0">
          <!-- MapLibre sets `position: relative` on its container, unlayered, so it beats Tailwind's `absolute`: the wrapper positions, the container fills it. -->
          <div class="absolute inset-0">
            <div ref="mapElement" class="h-full w-full" />
          </div>

          <PlanLegend
            v-if="planLegend && chrome.tools"
            class="absolute top-4 left-4 max-lg:top-3 max-lg:left-3"
            :class="{ 'transition-transform duration-200 ease-out': !resizing }"
            :style="{ transform: `translateX(${panelCover}px)` }"
            :name="planLegend.name"
            :color="planLegend.color" />

          <MapTools
            v-if="chrome.tools"
            class="absolute top-4 right-4 max-lg:top-3 max-lg:right-3"
            :stationNames
            :viewMode
            @zoomIn="store.map?.zoomIn()"
            @zoomOut="store.map?.zoomOut()"
            @fit="store.map?.fitNetwork()"
            @stationNames="stationNames = $event"
            @viewMode="viewMode = $event"
            @mapOnly="store.setMapOnly(true)"
            @help="store.setDialog('help')" />
          <UButton
            v-else
            icon="i-lucide-minimize-2"
            label="Exit map only"
            color="neutral"
            variant="outline"
            class="map-card absolute top-4 right-4 h-10 px-3 font-semibold"
            @click="store.setMapOnly(false)">
            <template #trailing>
              <UKbd value="Esc" />
            </template>
          </UButton>

          <!-- The time control, and above it while history plays the minimap, unless turned off; on a phone it rides above the sheet. -->
          <div
            v-show="chrome.timeControl"
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
              v-show="chrome.minimap"
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
              :settings="player"
              :viewMode
              :plan="planSummary"
              :planOnly
              @open="store.openTimeline"
              @close="store.closeTimeline"
              @today="store.pick({ kind: 'date', time: range.today })"
              @future="store.pick({ kind: 'future' })"
              @play="store.play"
              @pause="store.map?.pause()"
              @previous="store.stepTime(-1)"
              @skip="store.map?.skip()"
              @pick="store.pick"
              @settings="store.setPlayer"
              @viewMode="viewMode = $event"
              @exit="store.exitHistory" />
          </div>

          <!-- The map's credits stay on it: its licence asks for them. On a phone they fold into a button. -->
          <MapCredits v-if="chrome.credits === 'line'" :credits class="absolute right-2 bottom-1 max-w-[40%] text-right leading-4" />
          <UPopover v-else-if="chrome.credits === 'button'">
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

    <ExplorerSearch v-model:open="searchOpen" :stations :lines :city @station="store.pickStation" @line="store.pushLine" @city="emit('city', $event)" />
    <ExplorerHelp v-model:open="helpOpen" :sections :phone />
  </div>
</template>

<script setup lang="ts">
  import { useRoute } from '#imports';
  import type { Network } from '@railtime/schema/network.types';
  import { storeToRefs } from 'pinia';
  import { computed, useTemplateRef } from 'vue';

  import { useExplorerAddress } from '~/features/explorer/address/address.composable';
  import { parseExplorerQuery } from '~/features/explorer/address/address.utils';
  import { SHEET_HEIGHTS } from '~/features/explorer/explorer.constants';
  import { useExplorerStore } from '~/features/explorer/explorer.store';
  import type { Section } from '~/features/explorer/explorer.types';
  import { useExplorerLayout } from '~/features/explorer/layout.composable';
  import { useTransitMap } from '~/features/explorer/map/transitMap.composable';
  import { useExplorerPanel } from '~/features/explorer/panel/panel.composable';
  import { useExplorerPlan } from '~/features/explorer/plans/plan.composable';
  import { openingSectionOf } from '~/features/explorer/plans/plan.utils';
  import { useInsights } from '~/features/explorer/insights/insights.composable';
  import { useReachFinder } from '~/features/explorer/reach/reach.composable';
  import { useCoverage } from '~/features/explorer/coverage/coverage.composable';
  import { useRouteFinder } from '~/features/explorer/route/route.composable';
  import { useExplorerShortcuts } from '~/features/explorer/shortcuts.composable';

  const props = defineProps<{ network: Network; city: string; plan?: string }>();
  const emit = defineEmits<{ city: [city: string]; plan: [plan: string | undefined] }>();

  const explorer = useTemplateRef<HTMLElement>('explorer');
  const mapElement = useTemplateRef<HTMLElement>('mapElement');
  const minimapElement = useTemplateRef<HTMLElement>('minimapElement');

  // The store makes the network's facts, once for the page, and opens on them and on what the address says.
  const opening = parseExplorerQuery(useRoute().query);
  const openingSection = openingSectionOf(props.plan);
  const store = useExplorerStore();
  const { range } = store.open(props.network, props.plan, opening, openingSection);
  const {
    section,
    railSection,
    timeMode,
    phone,
    sheet,
    panelOpen,
    panelWidth,
    panelCover,
    viewMode,
    stationNames,
    player,
    chrome,
    routeEnds,
    routePreference,
    reachFrom,
    time,
    step,
    credits,
    planOnly,
    plans,
  } = storeToRefs(store);
  const searchOpen = store.dialogOpen('search');
  const helpOpen = store.dialogOpen('help');
  const citiesOpen = store.dialogOpen('cities');

  const { resizing, startResize } = useExplorerLayout(explorer);
  useTransitMap({ container: mapElement, minimapContainer: minimapElement });

  const { planSummary, planLegend, builtFacts, planMark, choosePlan } = useExplorerPlan({ onChoose: id => emit('plan', id) });
  const {
    sections,
    lines,
    changes,
    lineDetails,
    lineChanges,
    station,
    stations,
    stationColors,
    stationDirections,
    visible,
    setVisible,
    currentChange,
    panelTop,
    shownDate,
  } = useExplorerPanel();
  const { foundRoute, routeMark } = useRouteFinder();
  const { foundReach, reachMark } = useReachFinder();
  const { boundaryState, coverage, history: coverageHistory } = useCoverage(props.city);
  const { growth, hasHistory, records, shownYear } = useInsights();

  // A dot on each section whose choice is in force while another is open: a plan shown, a route or a reach set.
  const marks = computed(() => {
    const shown: Partial<Record<Section, string>> = {};
    if (planMark) shown.plans = planMark;
    if (routeMark.value) shown.route = routeMark.value;
    if (reachMark.value) shown.reach = reachMark.value;
    return shown;
  });

  useExplorerAddress(opening, openingSection);
  useExplorerShortcuts(sections);
</script>
