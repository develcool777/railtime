<template>
  <div ref="explorer" class="bg-page flex h-dvh w-full flex-col">
    <SiteHeader v-if="!mapOnly" wide>
      <template #context>
        <CitySelect v-model:open="cityMenuOpen" :city @city="emit('city', $event)" />
      </template>
      <template #center>
        <button
          type="button"
          class="bg-muted border-default hover:border-accented flex h-9 w-full max-w-[420px] items-center gap-2 rounded-lg border px-3 text-left transition-colors duration-150"
          @click="searchOpen = true">
          <UIcon name="i-lucide-search" class="text-muted size-4 flex-none" />
          <span class="text-muted min-w-0 flex-1 truncate text-sm">Find a station or line…</span>
          <span class="flex flex-none gap-1">
            <UKbd value="meta" />
            <UKbd value="K" />
          </span>
        </button>
      </template>
      <UButton v-if="phone" icon="i-lucide-search" color="neutral" variant="ghost" square aria-label="Search" @click="searchOpen = true" />
    </SiteHeader>

    <div class="relative flex min-h-0 flex-1">
      <ExplorerRail v-if="!phone && !mapOnly" :sections :open="panelOpen ? section : null" @pick="pickSection" />

      <!-- The panel: beside the map, a column that folds and resizes; on a phone, a sheet over it. -->
      <section
        v-if="!mapOnly"
        class="bg-default flex flex-col"
        :class="
          phone
            ? 'absolute inset-x-0 bottom-0 z-10 overflow-hidden rounded-t-lg shadow-[0_-8px_30px_rgba(21,32,48,0.1)] transition-[height] duration-200 ease-out'
            : ['relative flex-none', panelOpen ? 'border-default border-r' : '', resizing ? '' : 'transition-[width] duration-200 ease-out']
        "
        :style="phone ? { height: sheet === 'full' ? 'calc(100% - 8px)' : `${SHEET_HEIGHTS[sheet]}px` } : { width: `${panelOpen ? panelWidth : 0}px` }"
        aria-label="Panel">
        <ExplorerSheet v-if="phone" v-model:snap="sheet" :sections :open="sheet === 'peek' ? null : section" @pick="pickSection" />
        <div
          v-show="phone ? sheet !== 'peek' : panelOpen"
          class="flex min-h-0 flex-1 flex-col overflow-hidden"
          :style="phone ? undefined : { width: `${panelWidth}px` }">
          <PanelTop
            :title="panelTop.title"
            :context="panelTop.context"
            :dots="panelTop.dots"
            :backLabel="panelTop.backLabel"
            :foldable="!phone"
            @back="goBack"
            @fold="panelOpen = false" />
          <div class="min-h-0 flex-1 overflow-y-auto">
            <StationView
              v-if="station"
              :station
              :next="stationNeighbours"
              :date="shownDate"
              @select="openStation"
              @line="pushLine"
              @routeFrom="routeFromStation('from')"
              @routeTo="routeFromStation('to')" />
            <LineView v-else-if="lineDetails" :line="lineDetails" :changes="lineChanges" :stationColors @station="openStation" @change="showChange" />
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
              @swap="routeEnds = { from: routeEnds.to, to: routeEnds.from }"
              @preference="routePreference = $event"
              @station="openStation" />
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

      <main class="relative min-w-0 flex-1">
        <!-- MapLibre sets `position: relative` on its container, unlayered, so it beats Tailwind's `absolute`: the wrapper positions, the container fills it. -->
        <div class="absolute inset-0">
          <div ref="mapElement" class="h-full w-full" />
        </div>

        <PlanLegend v-if="planLegend && !mapOnly" class="absolute top-4 left-4 max-lg:top-3 max-lg:left-3" :name="planLegend.name" :color="planLegend.color" />

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
          class="pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 flex-col gap-3"
          :class="[timeMode === 'rest' ? 'items-center' : 'items-start', phone ? 'w-[calc(100%-24px)]' : 'w-[min(960px,calc(100%-32px))]']"
          :style="{ bottom: phone ? `${SHEET_HEIGHTS[sheet === 'full' ? 'half' : sheet] + 12}px` : '28px' }">
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
            @today="map?.setDate(range.today)"
            @future="showFuture"
            @play="timeMode === 'playing' ? map?.play() : playHistory()"
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

    <ExplorerSearch v-model:open="searchOpen" :stations :lines :city @station="openStation" @line="pushLine" @city="emit('city', $event)" />
  </div>
</template>

<script setup lang="ts">
  import { defineShortcuts, useColorMode, useCookie, useRoute, useRouter } from '#imports';
  import type { CameraMode, Padding, RoutePreference, RouteStop } from '@railtime/renderer/transitMap.types';
  import type { Network } from '@railtime/schema/network.types';
  import { isPlanOnly } from '@railtime/schema/plan.utils';
  import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

  import { currentChangeIndex } from '~/features/explorer/changes.utils';
  import { DEFAULT_SPEED, PANEL_WIDTH, PHONE_QUERY, SECTIONS, SHEET_HEIGHTS } from '~/features/explorer/explorer.constants';
  import type { Section, SheetSnap, TimeMode } from '~/features/explorer/explorer.types';
  import { formatExplorerQuery, parseExplorerQuery } from '~/features/explorer/explorerUrl.utils';
  import { formatDay, formatPlanFacts, formatStats, yearOf } from '~/features/explorer/format.utils';
  import { planFacts } from '~/features/explorer/plan.utils';
  import { nextStations } from '~/features/explorer/station.utils';
  import type { TimelineTarget } from '~/features/explorer/timeline.types';
  import { useTransitMap } from '~/features/explorer/transitMap.composable';

  const props = defineProps<{ network: Network; city: string; plan?: string }>();
  const emit = defineEmits<{ city: [city: string]; plan: [plan: string | undefined] }>();

  /** A year, in milliseconds, for the arrow keys. */
  const YEAR_MS = 365.25 * 864e5;

  const explorer = useTemplateRef<HTMLElement>('explorer');
  const mapElement = useTemplateRef<HTMLElement>('mapElement');
  const minimapElement = useTemplateRef<HTMLElement>('minimapElement');
  const route = useRoute();
  const router = useRouter();
  const colorMode = useColorMode();

  /** Below the rail's width the explorer is the phone's: the panel a sheet over the map. Client only, as the map is. */
  const phoneQuery = window.matchMedia(PHONE_QUERY);
  const phone = ref(phoneQuery.matches);
  const onPhoneChange = (event: MediaQueryListEvent) => (phone.value = event.matches);

  /** What the time control shows: the totals, the timeline, or the player. */
  const timeMode = ref<TimeMode>('rest');
  /** How high the phone's sheet stands. */
  const sheet = ref<SheetSnap>('peek');

  /**
   * Room the camera keeps clear of the cards on the map: the tools at the top right, the time
   * control at the bottom; on a phone, the sheet too.
   *
   * @returns The padding for the layout now.
   */
  const mapPadding = (): Padding => {
    const timeControl = { rest: 80, timeline: 130, playing: 150 }[timeMode.value];
    if (phone.value) return { top: 24, right: 64, left: 24, bottom: SHEET_HEIGHTS[sheet.value === 'full' ? 'half' : sheet.value] + timeControl - 20 };
    return { top: 64, right: 72, left: 48, bottom: timeControl };
  };

  // The address says what to open on: a day, a view, a station's panel.
  const opening = parseExplorerQuery(route.query);
  const { map, time, step, station, lines, changes, view } = useTransitMap({
    container: mapElement,
    minimapContainer: minimapElement,
    network: props.network,
    padding: mapPadding,
    ...(opening.view ? { view: opening.view } : {}),
    ...(props.plan ? { plan: props.plan } : {}),
  });
  watch([timeMode, sheet, phone], () => map.value?.setPadding(mapPadding()));

  const planOnly = isPlanOnly(props.network);
  const planCount = Object.keys(props.network.plans ?? {}).length;
  const chosenPlan = computed(() => (props.plan ? props.network.plans?.[props.plan] : undefined));
  /** What the plan shown adds, worked out once: it does not change. */
  const chosenFacts = props.plan ? planFacts(props.network, props.plan) : null;
  const planSummary = computed(() =>
    chosenPlan.value && chosenFacts ? { name: chosenPlan.value.name, facts: formatPlanFacts(chosenFacts.stations, chosenFacts.km) } : undefined,
  );
  /** The legend for the plan's dashed track, while the map shows its future. */
  const planLegend = computed(() => {
    const firstLine = chosenFacts?.lines[0];
    if (!chosenPlan.value || !time.value?.future || timeMode.value === 'playing') return null;
    if (!firstLine) return { name: chosenPlan.value.name, color: 'var(--ui-text-highlighted)' };
    return { name: chosenPlan.value.name, color: colorMode.value === 'light' ? firstLine.color : firstLine.darkColor };
  });
  const choosePlan = (id: string | undefined) => {
    if (id !== props.plan) emit('plan', id);
  };

  const speed = ref(DEFAULT_SPEED);
  const camera = ref<CameraMode>('follow');
  const visible = ref(new Set([...Object.keys(props.network.lines), ...Object.keys(chosenPlan.value?.lines ?? {})]));
  const range = computed(() => map.value?.range ?? { start: 0, end: Date.now(), today: Date.now() });
  const credits = computed(() => map.value?.credits ?? []);

  /** The panel's sections: Plans only for a city with plans. A plan opens on Plans, where it was picked. */
  const sections = SECTIONS.filter(entry => entry.id !== 'plans' || planCount > 0);
  const section = ref<Section>(props.plan ? 'plans' : 'lines');
  const sectionLabel = computed(() => sections.find(entry => entry.id === section.value)?.label ?? 'Lines');

  /** Whether the panel is open beside the map, and how wide: both kept in cookies. */
  const panelOpen = useCookie<boolean>('railtime-panel-open', { default: () => true });
  const panelWidth = useCookie<number>('railtime-panel-width', { default: () => PANEL_WIDTH.initial });

  /** The line whose view is pushed over the section, if any: its stops and history, on the date shown. */
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
  /** The stations on the map on the date shown, for the search; none while playing, when the panel follows the changes. */
  const stations = computed(() => (time.value && !time.value.playing && map.value ? map.value.getStations() : []));
  /** Each station's lines' colours, to mark a line's interchanges. */
  const stationColors = computed(() => new Map(stations.value.map(entry => [entry.id, entry.colors])));
  /** The stations one stop from the station whose view is open, on the date shown. */
  const stationNeighbours = computed(() => {
    const transitMap = map.value;
    // Read for the date shown: lines open and close.
    const shown = time.value?.cursor;
    if (!station.value || !transitMap || shown === undefined) return [];
    return nextStations(
      station.value.id,
      station.value.lines.map(line => transitMap.getLineDetails(line.id)),
    );
  });

  /**
   * Opens a section, over any pushed view. Beside the map, the open section's own icon folds the
   * panel, as an editor's activity bar does; on a phone, the sheet rises to half if it was down.
   */
  const pickSection = (id: Section) => {
    const showing = section.value === id && !station.value && !openLine.value;
    if (!phone.value && showing && panelOpen.value) {
      panelOpen.value = false;
      return;
    }
    openSection(id);
  };
  /** Opens a section, over any pushed view, and brings the panel into sight. */
  const openSection = (id: Section) => {
    section.value = id;
    closeStation();
    openLine.value = null;
    revealPanel();
  };
  /** Brings the panel into sight, for what was picked: unfolds it, or raises the phone's sheet to half. */
  const revealPanel = () => {
    if (!phone.value) panelOpen.value = true;
    else if (sheet.value === 'peek') sheet.value = 'half';
  };

  /** What the panel's top says: the view's title, its context and the way back. */
  const panelTop = computed(() => {
    if (station.value) {
      const opened = station.value.lines.flatMap(line => (line.opened ? [line.opened.slice(0, 4)] : [])).sort()[0];
      return {
        title: station.value.name,
        context: opened ? `opened ${opened}` : 'planned',
        dots: station.value.lines.map(line => line.color),
        backLabel: lineDetails.value?.name ?? sectionLabel.value,
      };
    }
    if (lineDetails.value) {
      const line = lineDetails.value;
      const opened = line.opened === null ? 'planned' : `opened ${yearOf(line.opened)}`;
      const open = line.branches.length > 0 ? ` · ${line.stations} stations · ${Math.round(line.km)} km` : '';
      return { title: line.name, context: `${opened}${open}`, dots: [line.color], backLabel: sectionLabel.value };
    }
    return { title: sectionTitle.value, context: sectionContext.value, dots: undefined, backLabel: undefined };
  });
  const sectionTitle = computed(() => {
    if (section.value === 'changes' && timeMode.value === 'playing') return props.plan ? 'Playing the future' : 'Playing history';
    return sectionLabel.value;
  });
  const sectionContext = computed(() => {
    if (section.value === 'lines') {
      const shown = lines.value.filter(line => visible.value.has(line.id)).length;
      return `${lines.value.length} ${lines.value.length === 1 ? 'line' : 'lines'} · ${shown} shown`;
    }
    if (section.value === 'changes') {
      if (timeMode.value === 'playing' && currentChange.value !== null && time.value)
        return `${currentChange.value + 1} of ${changes.value.length} · ${time.value.future ? 'Future' : formatDay(time.value.time)}`;
      const first = changes.value.find(change => change.time !== null)?.time;
      const count = `${changes.value.length} ${changes.value.length === 1 ? 'change' : 'changes'}`;
      return first ? `${count} since ${yearOf(first)}` : count;
    }
    if (section.value === 'route') return 'Between any two stations, on the date shown';
    return `${planCount} ${planCount === 1 ? 'plan' : 'plans'} drawn up`;
  });

  /** The way back from a pushed view: from a station to the line it was opened over, else to the section. */
  const goBack = () => {
    if (station.value) closeStation();
    else openLine.value = null;
  };

  /** Pushes a line's view, and brings the panel into sight. */
  const pushLine = (id: string) => {
    closeStation();
    openLine.value = id;
    revealPanel();
  };

  /** The change the map is at, for the Changes list. */
  const currentChange = computed(() => currentChangeIndex(changes.value, time.value, timeMode.value === 'playing' && step.value !== null));

  /** A change picked in a list: while playing, playback jumps to it; otherwise the timeline opens at it. */
  const pickChange = (index: number) => {
    if (timeMode.value === 'playing') map.value?.playFrom(index);
    else showChange(index);
  };
  const showChange = (index: number) => map.value?.showChange(index);

  /** A route between two stations, on the date shown: drawn on the map while its section is open. */
  const routeEnds = ref<{ from: RouteStop | null; to: RouteStop | null }>({ from: null, to: null });
  const routePreference = ref<RoutePreference>('fastest');
  const foundRoute = computed(() => {
    const { from, to } = routeEnds.value;
    // Found again for the date shown: lines open and close.
    const shown = time.value?.cursor;
    return from && to && map.value && shown !== undefined ? map.value.findRoute(from.id, to.id, routePreference.value) : null;
  });
  const routeShown = computed(() => section.value === 'route' && timeMode.value !== 'playing');
  watch([foundRoute, routeShown], () => map.value?.showRoute(routeShown.value ? foundRoute.value : null));
  /** Starts or ends a route at the station whose view is open, and goes to the route. */
  const routeFromStation = (end: 'from' | 'to') => {
    if (!station.value) return;
    routeEnds.value = { ...routeEnds.value, [end]: { id: station.value.id, name: station.value.name } };
    openSection('route');
  };

  /** The lines the map brings forward: a line's own in its view, a route's on the route; every line otherwise. */
  const focusedLines = computed(() => {
    if (timeMode.value === 'playing' || station.value) return null;
    if (lineDetails.value) return [lineDetails.value.id];
    if (routeShown.value && foundRoute.value) return foundRoute.value.legs.flatMap(leg => (leg.kind === 'ride' ? [leg.line] : []));
    return null;
  });
  watch(focusedLines, (next, previous) => {
    if (JSON.stringify(next) !== JSON.stringify(previous)) map.value?.focusLines(next);
  });

  /** The date shown, for what had opened by then; `null` in a plan's future. */
  const shownDate = computed(() => (!time.value || time.value.future ? null : time.value.time));

  /** What is built today, for the Plans section's first card: read once the map first shows today. */
  const builtFacts = ref('');
  watch(time, now => {
    if (!builtFacts.value && !props.plan && now && now.cursor === now.todayCursor && !now.future) builtFacts.value = formatStats(now.stats);
  });

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
    // When playback reaches the end, the timeline stays, at today.
    transitMap.on('end', () => {
      if (timeMode.value === 'playing') timeMode.value = 'timeline';
    });
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
    if (timeMode.value === 'playing') return;
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

  /** The network as it is: today, or with a plan its future built. */
  const atRest = computed(() => {
    const now = time.value;
    if (!now) return true;
    return props.plan ? now.future : now.cursor === now.todayCursor && !now.future;
  });
  // A date away from that (a link's, a change picked in the panel) opens the timeline, so the way back is in sight.
  watch(atRest, rest => {
    if (!rest && timeMode.value === 'rest') timeMode.value = 'timeline';
  });
  /** A network never built has no years to slide through: its button plays the plan. */
  const openTimeline = () => {
    if (planOnly) playHistory();
    else timeMode.value = 'timeline';
  };
  const closeTimeline = () => {
    timeMode.value = 'rest';
    showFuture();
  };

  /** Plays the history from its start (with a plan, the future from today), the panel following on Changes. */
  const playHistory = () => {
    closeStation();
    openLine.value = null;
    section.value = 'changes';
    timeMode.value = 'playing';
    map.value?.setSpeed(speed.value);
    map.value?.setCameraMode(camera.value);
    map.value?.setDate(props.plan ? range.value.today : range.value.start);
    map.value?.play();
  };

  /** Leaves the player for the timeline, at the date reached. */
  const exitHistory = () => {
    map.value?.pause();
    timeMode.value = 'timeline';
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
    const wasPlaying = timeMode.value === 'playing' && time.value?.playing === true;
    if (target.kind === 'future') showFuture();
    else if (target.kind === 'change') transitMap.showChange(target.index);
    else transitMap.setDate(target.time);
    if (wasPlaying && target.kind !== 'future') transitMap.play();
  };

  const setSpeed = (value: number) => {
    speed.value = value;
    map.value?.setSpeed(value);
  };

  const setCamera = (value: CameraMode) => {
    camera.value = value;
    map.value?.setCameraMode(value);
  };

  /** The minimap shows where the camera is while it follows playback, beside the map. */
  const minimapShown = computed(() => timeMode.value === 'playing' && camera.value === 'follow' && !phone.value);

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

  /** Only the map: the header, rail, panel and time control hidden, the page full screen where the browser lets it. */
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

  /** Dragging the panel's edge: where the drag began, and the width then. */
  const resizing = ref(false);
  const startResize = (event: PointerEvent) => {
    const startX = event.clientX;
    const startWidth = panelWidth.value;
    resizing.value = true;
    const onMove = (move: PointerEvent) => {
      panelWidth.value = Math.round(Math.min(Math.max(startWidth + move.clientX - startX, PANEL_WIDTH.min), PANEL_WIDTH.max));
    };
    const onUp = () => {
      resizing.value = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const searchOpen = ref(false);
  const cityMenuOpen = ref(false);

  /** A year back or forward; while playing, the change before or the next. */
  const stepTime = (direction: -1 | 1) => {
    const now = time.value;
    if (!now || !map.value || planOnly) return;
    if (timeMode.value === 'playing') {
      if (direction > 0) map.value.skip();
      else map.value.playFrom(Math.max((currentChange.value ?? 0) - 1, 0));
      return;
    }
    map.value.setDate(Math.min(Math.max(now.time + direction * YEAR_MS, range.value.start), range.value.end));
  };

  /** Esc closes the innermost thing open: a menu or the search (they close themselves), then map only, then a pushed view. */
  const closeInnermost = () => {
    if (document.querySelector('[data-dismissable-layer]')) return;
    if (mapOnly.value) void toggleMapOnly();
    else if (station.value || openLine.value) goBack();
  };

  defineShortcuts({
    '/': () => (searchOpen.value = true),
    '[': () => {
      if (!phone.value) panelOpen.value = !panelOpen.value;
    },
    ...Object.fromEntries(sections.map((entry, position) => [String(position + 1), () => openSection(entry.id)])),
    h: () => {
      if (timeMode.value === 'rest') openTimeline();
      else if (timeMode.value === 'timeline') closeTimeline();
    },
    ' ': () => {
      if (timeMode.value !== 'playing') playHistory();
      else if (time.value?.playing) map.value?.pause();
      else map.value?.play();
    },
    arrowleft: () => stepTime(-1),
    arrowright: () => stepTime(1),
    n: () => setStationNames(!stationNames.value),
    f: () => void toggleMapOnly(),
    escape: closeInnermost,
  });

  onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange);
    phoneQuery.addEventListener('change', onPhoneChange);
  });
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    phoneQuery.removeEventListener('change', onPhoneChange);
  });
</script>
