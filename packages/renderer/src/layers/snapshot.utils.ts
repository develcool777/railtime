import type { LineSegment } from '@railtime/network/engine/index.types';
import type { LineFeature, StationLines } from './features.types';
import { lineFeature } from './features.utils';
import type { RenderState, ResolvedLine, SideBySide } from './lineStyle.types';
import { offsetFor, resolveLine } from './lineStyle.utils';
import type { NetworkSnapshot } from './snapshot.types';

/**
 * Which lines run side by side on each segment: those open, plus those the playing step is opening,
 * so the track already on the map makes room before the new line draws in.
 *
 * @param state - The frame's render state.
 * @param lineSegments - The visible line segments.
 * @param resolved - Each line as drawn.
 * @param stepPlaying - A step is playing at the cursor.
 * @returns The lines on each segment, in side-by-side order.
 */
const buildSideBySide = (state: RenderState, lineSegments: LineSegment[], resolved: Map<string, ResolvedLine>, stepPlaying: boolean): SideBySide => {
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
const linkTransfers = (state: RenderState, stations: Map<string, StationLines>): { transfers: LineFeature[]; linked: Set<string> } => {
  const transfers: LineFeature[] = [];
  const linked = new Set<string>();
  for (const { stationA, stationB } of state.index.network.transfers ?? []) {
    if (!stations.has(stationA) || !stations.has(stationB)) continue;
    transfers.push(lineFeature([state.index.coordOf(stationA), state.index.coordOf(stationB)], '', 0));
    linked.add(stationA).add(stationB);
  }
  return { transfers, linked };
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
  const visible = index.lineSegments.filter(lineSegment => state.visibleLines.has(lineSegment.line));
  const closingNow = (lineSegment: LineSegment) => stepPlaying && timeline.closesAt(lineSegment, cursor);
  const sideBySide = buildSideBySide(state, visible, resolved, stepPlaying);

  const lines: LineFeature[] = [];
  const planned: LineFeature[] = [];
  const ghosts: LineFeature[] = [];
  const drawn = new Set<string>();
  const stations = new Map<string, StationLines>();
  const stayingStations = new Set<string>();
  const builtStations = new Set<string>();
  const segmentsOnMap = new Set<number>();
  const linesOnMap = new Set<string>();

  for (const lineSegment of visible) {
    const { segment } = lineSegment;
    // Closed track is a ghost until its line returns there.
    const returned = lineSegment.next !== null && (timeline.isOpen(lineSegment.next, cursor) || timeline.hasClosed(lineSegment.next, cursor));
    if ((timeline.hasClosed(lineSegment, cursor) || closingNow(lineSegment)) && !returned)
      ghosts.push(lineFeature(segment.coordinates, state.baseColor(lineSegment.line), 0, 0, lineSegment.line));
    if (!timeline.isOpen(lineSegment, cursor)) continue;
    const line = resolved.get(lineSegment.line)!;
    const key = `${segment.index}|${line.id}`;
    const isPlanned = lineSegment.section !== null;
    if (!closingNow(lineSegment) && !drawn.has(key)) {
      drawn.add(key);
      (isPlanned ? planned : lines).push(lineFeature(segment.coordinates, line.color, offsetFor(sideBySide, segment, line.id), 0, lineSegment.line));
    }
    segmentsOnMap.add(segment.index);
    linesOnMap.add(line.id);
    for (const station of [segment.stationA, segment.stationB]) {
      if (!timeline.servesStation(station, lineSegment.line, cursor)) continue;
      const served = stations.get(station) ?? new Map();
      served.set(line.id, line.color);
      stations.set(station, served);
      if (!closingNow(lineSegment)) stayingStations.add(station);
      if (!isPlanned) builtStations.add(station);
    }
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
    plannedStations: new Set([...stations.keys()].filter(station => !builtStations.has(station))),
    closingOnly: new Set([...stations.keys()].filter(station => !stayingStations.has(station))),
    stats: {
      stations: stations.size,
      km: [...segmentsOnMap].reduce((total, segmentIndex) => total + (index.segments[segmentIndex]?.lengthKm ?? 0), 0),
      lines: linesOnMap.size,
    },
  };
};
