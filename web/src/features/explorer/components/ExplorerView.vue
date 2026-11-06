<template>
  <div ref="explorer" class="bg-page flex h-dvh w-full flex-col">
    <SiteHeader v-if="chrome.header" wide>
      <template #context>
        <CitySelect
          :open="dialog === 'cities'"
          :city
          @update:open="$event ? store.OPEN_DIALOG('cities') : store.CLOSE_DIALOG('cities')"
          @city="emit('city', $event)" />
      </template>
      <template #center>
        <!-- Opens the search, as ⌘K and / do. -->
        <UDashboardSearchButton label="Find a station or line…" color="neutral" class="w-full max-w-[420px]" @click="store.OPEN_DIALOG('search')" />
      </template>
      <UButton v-if="phone" icon="i-lucide-search" color="neutral" variant="ghost" square aria-label="Search" @click="store.OPEN_DIALOG('search')" />
    </SiteHeader>

    <div class="relative flex min-h-0 flex-1">
      <ExplorerRail v-if="chrome.rail" :sections :open="panelOpen ? railSection : null" :marks @pick="store.PICK_SECTION" />

      <!-- The map keeps its size: the panel slides over its left edge, which resizing it every frame would make stutter. -->
      <div class="relative min-w-0 flex-1 overflow-hidden">
        <!-- The panel: over the map's left, a column that folds and resizes; on a phone, a drawer over its foot. -->
        <ExplorerPanel
          v-if="chrome.panel"
          :snap="sheet"
          :phone
          :tabLabels
          :open="panelOpen"
          :width="panelWidth"
          :resizing
          :sections
          :section="railSection"
          :marks
          @update:snap="layout.SET_SHEET"
          @pick="store.PICK_SECTION"
          @resize="startResize">
          <PanelTop
            :title="panelTop.title"
            :context="panelTop.context"
            :dots="panelTop.dots"
            :backLabel="panelTop.backLabel"
            :foldable="!phone"
            @back="store.GO_BACK"
            @fold="store.SET_PANEL_OPEN(false)" />
          <div class="min-h-0 flex-1 overflow-y-auto">
            <StationView v-if="station" :station :directions="stationDirections" @station="store.WALK_TO" @line="store.PUSH_LINE" />
            <LineView
              v-else-if="lineDetails"
              :line="lineDetails"
              :changes="lineChanges"
              :stationColors
              @station="store.PICK_STATION"
              @pickChange="timeStore.PICK({ kind: 'change', index: $event })" />
            <StationsSection v-else-if="section === 'stations'" :stations @open="store.PICK_STATION" />
            <LinesSection
              v-else-if="section === 'lines'"
              :lines
              :choices="networkChoices"
              :opened="linesOpened"
              @show="store.SHOW_LINES"
              @open="store.PUSH_LINE" />
            <ChangesSection
              v-else-if="section === 'changes'"
              :changes
              :current="currentChange"
              :playing="timeStore.playerShown"
              @pick="timeStore.PICK_CHANGE" />
            <RouteSection
              v-else-if="section === 'route'"
              :stations
              :ends="routeStops"
              :aim="tools.routeAim"
              :found="foundRoutes"
              @end="tools.SET_ROUTE_END"
              @aim="tools.AIM_ROUTE"
              @clear="tools.CLEAR_ROUTE"
              @swap="tools.SWAP_ENDS"
              @option="tools.CHOOSE_ROUTE"
              @station="store.PICK_STATION" />
            <ReachSection
              v-else-if="section === 'reach'"
              :stations
              :from="reachStop"
              :reach="foundReach"
              @from="tools.SET_REACH_FROM"
              @station="store.PICK_STATION" />
            <CoverageSection
              v-else-if="section === 'coverage'"
              :state="boundaryState"
              :coverage
              :history="coverageHistory"
              :distance="tools.coverageMetres"
              @year="timeStore.SHOW_YEAR"
              @distance="tools.SHOW_COVERAGE_WITHIN" />
            <InsightsSection
              v-else-if="section === 'insights'"
              :growth
              :hasHistory
              :records
              :year="shownYear"
              @year="timeStore.SHOW_YEAR"
              @station="store.PICK_STATION"
              @line="store.PUSH_LINE" />
            <PlansSection v-else :plans :planOnly :plan="pickedPlan" :built="builtFacts" @choose="store.SHOW_PLAN" />
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
            :streetNames
            :trains
            :viewMode
            @zoomIn="mapStore.ZOOM_IN"
            @zoomOut="mapStore.ZOOM_OUT"
            @fit="mapStore.FIT_NETWORK"
            @stationNames="store.SET_STATION_NAMES"
            @trains="store.SET_TRAINS"
            @streetNames="store.SET_STREET_NAMES"
            @viewMode="store.SET_VIEW_MODE"
            @mapOnly="store.SET_MAP_ONLY(true)"
            @help="store.OPEN_DIALOG('help')" />
          <UButton
            v-else
            icon="i-lucide-minimize-2"
            label="Exit map only"
            color="neutral"
            variant="outline"
            class="map-card absolute top-4 right-4 h-10 px-3 font-semibold"
            @click="store.SET_MAP_ONLY(false)">
            <template #trailing>
              <UKbd value="Esc" />
            </template>
          </UButton>

          <!-- The time control, and above it while history plays the minimap, unless turned off; on a phone it rides above the sheet. -->
          <div
            v-show="chrome.timeControl"
            class="pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col items-start gap-3"
            :class="{ 'transition-[left,width] duration-200 ease-out': !resizing }"
            :style="{
              bottom: sheetHeight === null ? '28px' : `${sheetHeight + 12}px`,
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
              v-if="range"
              class="pointer-events-auto"
              :mode="timeMode"
              :phone
              :time
              :changes
              :range
              :step
              :settings="player"
              :plan="planSummary"
              :planOnly
              @togglePlay="timeStore.TOGGLE_PLAY"
              @previous="timeStore.PREVIOUS_CHANGE"
              @skip="timeStore.NEXT_CHANGE"
              @leave="timeStore.LEAVE_TO"
              @pick="timeStore.PICK"
              @settings="timeStore.SET_PLAYER" />
          </div>

          <!-- The map's credits stay on it: its tiles' licences ask for them; the rest are on the About page. On a phone they fold into a button. -->
          <MapCredits v-if="chrome.credits === 'line'" :credits about class="absolute right-2 bottom-1 max-w-[40%] text-right leading-4" />
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
              <MapCredits :credits about class="max-w-72 p-3" />
            </template>
          </UPopover>
        </main>
      </div>
    </div>

    <ExplorerSearch
      :open="dialog === 'search'"
      :stations
      :lines
      :city
      @update:open="$event ? store.OPEN_DIALOG('search') : store.CLOSE_DIALOG('search')"
      @station="store.PICK_STATION"
      @line="store.PUSH_LINE"
      @city="emit('city', $event)" />
    <ExplorerHelp :open="dialog === 'help'" :sections :phone @update:open="$event ? store.OPEN_DIALOG('help') : store.CLOSE_DIALOG('help')" />
  </div>
</template>

<script setup lang="ts">
  import type { Network } from '@railtime/schema/network.types';
  import { storeToRefs } from 'pinia';
  import { useTemplateRef } from 'vue';
  import { useRoute, useRouter, useRuntimeConfig } from '#imports';
  import { useExplorerAddress } from '~/features/explorer/address/address.composable';
  import { parseExplorerQuery } from '~/features/explorer/address/address.utils';
  import { useExplorerStore } from '~/features/explorer/explorer.store';
  import { useExplorerLayout } from '~/features/explorer/layout.composable';
  import { useLayoutStore } from '~/features/explorer/layout.store';
  import { useMapStore } from '~/features/explorer/map/map.store';
  import { useTransitMap } from '~/features/explorer/map/transitMap.composable';
  import { useNetworkStore } from '~/features/explorer/network.store';
  import { usePanelStore } from '~/features/explorer/panel/panel.store';
  import { useRecordedExplorer } from '~/features/explorer/recorded.composable';
  import { useExplorerShortcuts } from '~/features/explorer/shortcuts.composable';
  import { useTimeStore } from '~/features/explorer/time/time.store';
  import { useToolsStore } from '~/features/explorer/tools.store';
  import { boundaryUrlOf } from '~/utils/city.utils';

  const props = defineProps<{
    /** The city's network, as its file holds it. */
    network: Network;
    /** The city, by its id. */
    city: string;
  }>();
  const emit = defineEmits<{ city: [city: string] }>();

  const explorer = useTemplateRef<HTMLElement>('explorer');
  const mapElement = useTemplateRef<HTMLElement>('mapElement');
  const minimapElement = useTemplateRef<HTMLElement>('minimapElement');

  // The stores open on the city's network and on what the address says, once: the page makes the view
  // afresh for each city (its `key`). From then on they are its one source of truth, and what follows
  // only lays out what they hold.
  const store = useExplorerStore();
  const networkStore = useNetworkStore();
  const mapStore = useMapStore();
  const layout = useLayoutStore();
  const timeStore = useTimeStore();
  const tools = useToolsStore();
  const panel = usePanelStore();
  const route = useRoute();
  const router = useRouter();
  const baseURL = useRuntimeConfig().app.baseURL;
  const opening = () => ({ stored: props.network, asked: parseExplorerQuery(route.query), outline: `${baseURL}${boundaryUrlOf(props.city)}` });
  store.OPEN(opening());

  const { section, railSection, dialog, panelOpen, panelCover, viewMode, stationNames, trains, streetNames, chrome } = storeToRefs(store);
  const { phone, tabLabels, sheet, sheetHeight, panelWidth, resizing } = storeToRefs(layout);
  const { lines, changes, plans, pickedPlan, planOnly, networkChoices, growth, hasHistory, range } = storeToRefs(networkStore);
  const { credits } = storeToRefs(mapStore);
  const { timeMode, player, time, step, shownYear } = storeToRefs(timeStore);
  const { foundRoutes, foundReach, coverage, coverageHistory, boundaryState } = storeToRefs(tools);
  const {
    sections,
    lineDetails,
    lineChanges,
    station,
    stations,
    stationColors,
    stationDirections,
    linesOpened,
    routeStops,
    reachStop,
    currentChange,
    panelTop,
    records,
    planSummary,
    planLegend,
    builtFacts,
    marks,
  } = storeToRefs(panel);

  // The effects: the browser, the map, the address bar and the keys, each tied to the stores.
  const { startResize } = useExplorerLayout(explorer);
  useTransitMap({ container: mapElement, minimapContainer: minimapElement });
  useExplorerAddress({ query: () => route.query, replace: query => void router.replace({ query }) });
  useExplorerShortcuts();
  useRecordedExplorer();
</script>
