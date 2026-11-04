import type { LngLat } from '@railtime/core/geometry.types';
import type { LineSegment } from '@railtime/network/engine.types';
import type { LineId, StationId } from '@railtime/schema/network.types';
import type { FeatureCollection, LineFeature, NetworkSnapshot, PointFeature, StationLines, StationsFound } from './snapshot.types';
import type { RenderState, ResolvedLine, SideBySide } from './style.types';
import { offsetFor, resolveLine } from './style.utils';

/**
 * Which lines run side by side on each segment: those open, plus those the playing step is opening,
 * so the track already on the map makes room before the new line draws in.
 *
 * @param state - The frame's render state.
 * @param lineSegments - The line segments.
 * @param resolved - Each line as drawn.
 * @param stepPlaying - A step is playing at the cursor.
 * @returns The lines on each segment, in side-by-side order.
 */
const buildSideBySide = (state: RenderState, lineSegments: LineSegment[], resolved: Map<LineId, ResolvedLine>, stepPlaying: boolean): SideBySide => {
  const sideBySide: SideBySide = new Map();
  for (const lineSegment of lineSegments) {
    const onMap = state.timeline.isOpen(lineSegment, state.cursor) || (stepPlaying && state.timeline.opensAt(lineSegment, state.cursor));
    if (!onMap) continue;
    const lineId = resolved.get(lineSegment.line)!.id;
    const onSegment = sideBySide.get(lineSegment.segment.index) ?? [];
    if (!onSegment.includes(lineId)) onSegment.push(lineId);
    sideBySide.set(lineSegment.segment.index, onSegment);
  }
  for (const lines of sideBySide.values()) lines.sort(state.index.compareLines);
  return sideBySide;
};

/**
 * The transfers with both stations on the map: a link between their dots, and the stations so linked.
 *
 * @param state - The frame's render state.
 * @param stations - The stations on the map.
 * @returns The links, and the stations at either end.
 */
const linkTransfers = (state: RenderState, stations: Map<StationId, StationLines>): { transfers: LineFeature[]; linked: Set<StationId> } => {
  const transfers: LineFeature[] = [];
  const linked = new Set<StationId>();
  for (const { stationA, stationB } of state.index.network.transfers ?? []) {
    if (!stations.has(stationA) || !stations.has(stationB)) continue;
    transfers.push(lineFeature([state.index.coordOf(stationA), state.index.coordOf(stationB)], '', 0));
    linked.add(stationA).add(stationB);
  }
  return { transfers, linked };
};

/**
 * Whether a line's track shows as a ghost: track a line is leaving is one as it goes; suspended, until
 * its line returns there. Closed for good, it is gone.
 *
 * @param state - The frame's render state.
 * @param lineSegment - The line's track on a segment.
 * @param closing - The step playing closes it.
 * @returns Whether it is drawn as a ghost.
 */
const leavesGhost = (state: RenderState, lineSegment: LineSegment, closing: boolean): boolean => {
  const { timeline, cursor } = state;
  const suspended = lineSegment.next !== null && timeline.hasClosed(lineSegment, cursor);
  const returned = lineSegment.next !== null && (timeline.isOpen(lineSegment.next, cursor) || timeline.hasClosed(lineSegment.next, cursor));
  return (closing || suspended) && !returned;
};

/**
 * Adds the stations an open line's track serves at its ends to those on the map, with the line's colour.
 *
 * @param state - The frame's render state.
 * @param lineSegment - The line's track on a segment, open at the cursor.
 * @param line - The line as drawn.
 * @param closing - The step playing closes it: its stations stay only by another line.
 * @param found - The stations so far, and those staying and built.
 */
const addServedStations = (state: RenderState, lineSegment: LineSegment, line: ResolvedLine, closing: boolean, found: StationsFound): void => {
  const { segment } = lineSegment;
  for (const station of [segment.stationA, segment.stationB]) {
    if (!state.timeline.servesStation(station, lineSegment.line, state.cursor)) continue;
    const served = found.stations.get(station) ?? new Map<LineId, string>();
    served.set(line.id, line.color);
    found.stations.set(station, served);
    if (!closing) found.staying.add(station);
    if (lineSegment.section === null) found.built.add(station);
  }
};

/**
 * Everything already on the map at the cursor: lines, planned and closed track, stations and their lines, stats.
 *
 * @param state - The frame's render state.
 * @param stepPlaying - A step is playing at the cursor (its openings make room, its closures fade).
 * @returns The snapshot.
 */
export const buildNetworkSnapshot = (state: RenderState, stepPlaying: boolean): NetworkSnapshot => {
  const { timeline, cursor, index } = state;
  const resolved = new Map(index.lineIds.map(line => [line, resolveLine(state, line)]));
  const closingNow = (lineSegment: LineSegment) => stepPlaying && timeline.closesAt(lineSegment, cursor);
  const sideBySide = buildSideBySide(state, index.lineSegments, resolved, stepPlaying);

  const lines: LineFeature[] = [];
  const planned: LineFeature[] = [];
  const ghosts: LineFeature[] = [];
  // The lines drawn on each segment: a line drawn as another is drawn once.
  const drawn = new Map<number, Set<LineId>>();
  const found: StationsFound = { stations: new Map(), staying: new Set(), built: new Set() };
  const { stations } = found;
  const segmentsOnMap = new Set<number>();
  const linesOnMap = new Set<LineId>();

  for (const lineSegment of index.lineSegments) {
    const { segment } = lineSegment;
    const closing = closingNow(lineSegment);
    if (leavesGhost(state, lineSegment, closing)) ghosts.push(lineFeature(segment.coordinates, state.baseColor(lineSegment.line), 0, 0, lineSegment.line));
    if (!timeline.isOpen(lineSegment, cursor)) continue;
    const line = resolved.get(lineSegment.line)!;
    const isPlanned = lineSegment.section !== null;
    const drawnHere = drawn.get(segment.index) ?? new Set<LineId>();
    if (!closing && !drawnHere.has(line.id)) {
      drawnHere.add(line.id);
      drawn.set(segment.index, drawnHere);
      (isPlanned ? planned : lines).push(lineFeature(segment.coordinates, line.color, offsetFor(sideBySide, segment, line.id), 0, lineSegment.line, isPlanned));
    }
    segmentsOnMap.add(segment.index);
    linesOnMap.add(line.id);
    addServedStations(state, lineSegment, line, closing, found);
  }

  const { transfers, linked } = linkTransfers(state, stations);

  return {
    sideBySide,
    lines: { type: 'FeatureCollection', features: lines },
    planned: { type: 'FeatureCollection', features: planned },
    ghosts: { type: 'FeatureCollection', features: ghosts },
    transfers: { type: 'FeatureCollection', features: transfers },
    linked,
    stations,
    plannedStations: new Set([...stations.keys()].filter(station => !found.built.has(station))),
    closingOnly: new Set([...stations.keys()].filter(station => !found.staying.has(station))),
    stats: {
      stations: stations.size,
      km: [...segmentsOnMap].reduce((total, segmentIndex) => total + (index.segments[segmentIndex]?.lengthKm ?? 0), 0),
      lines: linesOnMap.size,
    },
  };
};

/**
 * A collection with no features.
 *
 * @returns An empty feature collection.
 */
export const emptyCollection = <Item>(): FeatureCollection<Item> => ({ type: 'FeatureCollection', features: [] });

/**
 * A line feature.
 *
 * @param coordinates - Its points, in the direction it is drawn.
 * @param color - Its colour.
 * @param offset - Its side-by-side slot, relative to the direction of `coordinates`.
 * @param highlight - 0 normally, up to 1 for new track.
 * @param line - The line it is drawn for; none for a transfer's link.
 * @param planned - A plan's track, not built: drawn dashed.
 * @returns The feature.
 */
export const lineFeature = (coordinates: LngLat[], color: string, offset: number, highlight = 0, line: LineId | '' = '', planned = false): LineFeature => ({
  type: 'Feature',
  properties: { color, offset, highlight, line, planned },
  geometry: { type: 'LineString', coordinates },
});

/**
 * A point feature.
 *
 * @param coordinates - Where it is.
 * @param properties - Its properties.
 * @returns The feature.
 */
export const pointFeature = <Properties>(coordinates: LngLat, properties: Properties): PointFeature<Properties> => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates },
});
