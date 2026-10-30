import type { NetworkIndex } from './networkIndex.service';
import { PriorityQueue } from './priorityQueue.service';
import { CHANGE_MINUTES, FEWER_CHANGES_PENALTY, RIDE_KMH, WALK_MINUTES } from './routeFinder.constants';
import type { Edge, Move, Place, RideLeg, Route, RouteLeg, RoutePreference } from './routeFinder.types';
import type { Timeline } from './timeline.service';

/**
 * Finds the best way from one station to another on the network of a date, with Dijkstra's
 * shortest path. Its graph's nodes are places, each a station on a line: riding a segment costs the
 * minutes the track takes, changing line at a station or walking a transfer a few more and, when
 * changes should be few, more still. A line passes a station it does not call at, but no one gets on
 * or off there. Each search is for one date (`cursor`); the finder keeps nothing between them.
 */
export class RouteFinder {
  /** The network. */
  private readonly index: NetworkIndex;
  /** When each line opened, closed and called where. */
  private readonly timeline: Timeline;
  /** The network as it was at this cursor, for the search under way. */
  private cursor = 0;
  /** Minutes a change counts for on top, for the search under way. */
  private penalty = 0;

  public constructor(index: NetworkIndex, timeline: Timeline) {
    this.index = index;
    this.timeline = timeline;
  }

  /**
   * The best route between two stations.
   *
   * @param from - The station to start at.
   * @param to - The station to get to.
   * @param cursor - The cursor: the network as it was then.
   * @param preference - Fastest, or fewer changes.
   * @returns The route, or `null` if there is none (or the two are the same station).
   */
  public find(from: string, to: string, cursor: number, preference: RoutePreference = 'fastest'): Route | null {
    if (from === to) return null;
    this.cursor = cursor;
    this.penalty = preference === 'fewer-changes' ? FEWER_CHANGES_PENALTY : 0;
    const reached = this.search(from, to);
    if (!reached) return null;
    return this.routeOf(reached.place, reached.arrivals);
  }

  /**
   * How long the fastest routes take from one station to every other the network of a date reaches:
   * the search `find` makes, run to the end.
   *
   * @param from - The station to start at.
   * @param cursor - The cursor: the network as it was then.
   * @returns Minutes to each station reached, by id, the start's 0; none if no line calls at the start.
   */
  public reach(from: string, cursor: number): Map<string, number> {
    this.cursor = cursor;
    this.penalty = 0;
    const minutes = new Map<string, number>();
    const best = new Map<Place, number>();
    const queue = new PriorityQueue<Place>();
    for (const line of this.linesCallingAt(from)) {
      best.set(this.placeOf(from, line), 0);
      queue.push(this.placeOf(from, line), 0);
    }
    for (let next = queue.pop(); next; next = queue.pop()) {
      const { item: place, cost } = next;
      if (cost > (best.get(place) ?? Infinity)) continue;
      const { station, line } = this.partsOf(place);
      // Places come off the queue soonest first: the first a line calls at is the station's time.
      if (!minutes.has(station) && this.timeline.servesStation(station, line, this.cursor)) minutes.set(station, cost);
      for (const edge of this.edgesFrom(place)) {
        const total = cost + edge.minutes;
        if (total >= (best.get(edge.to) ?? Infinity)) continue;
        best.set(edge.to, total);
        queue.push(edge.to, total);
      }
    }
    return minutes;
  }

  /**
   * Dijkstra's search, from every line calling at the start until a line calling at the end.
   *
   * @param from - The station to start at.
   * @param to - The station to get to.
   * @returns The place it ended at, and how each place on the way was reached; `null` if it was not.
   */
  private search(from: string, to: string): { place: Place; arrivals: Map<Place, { from: Place; move: Move }> } | null {
    const best = new Map<Place, number>();
    const arrivals = new Map<Place, { from: Place; move: Move }>();
    const queue = new PriorityQueue<Place>();
    for (const line of this.linesCallingAt(from)) {
      best.set(this.placeOf(from, line), 0);
      queue.push(this.placeOf(from, line), 0);
    }
    for (let next = queue.pop(); next; next = queue.pop()) {
      const { item: place, cost } = next;
      // An entry left behind by a cheaper way found later.
      if (cost > (best.get(place) ?? Infinity)) continue;
      const { station, line } = this.partsOf(place);
      if (station === to && this.timeline.servesStation(station, line, this.cursor)) return { place, arrivals };
      for (const edge of this.edgesFrom(place)) {
        const total = cost + edge.minutes;
        if (total >= (best.get(edge.to) ?? Infinity)) continue;
        best.set(edge.to, total);
        arrivals.set(edge.to, { from: place, move: edge.move });
        queue.push(edge.to, total);
      }
    }
    return null;
  }

  /**
   * Where one can go from a place: on along the line, to another line at the station, or on foot to
   * a station a transfer links. Only a station the line calls at lets one off.
   *
   * @param place - The place.
   * @returns The edges out of it.
   */
  private edgesFrom(place: Place): Edge[] {
    const { station, line } = this.partsOf(place);
    const edges: Edge[] = [];
    for (const lineSegment of this.index.lineSegmentsAt(station)) {
      if (lineSegment.line !== line || !this.timeline.isOpen(lineSegment, this.cursor)) continue;
      const { segment } = lineSegment;
      const next = segment.stationA === station ? segment.stationB : segment.stationA;
      edges.push({
        to: this.placeOf(next, line),
        minutes: this.rideMinutes(segment.lengthKm),
        move: { kind: 'ride', segment: segment.index, km: segment.lengthKm },
      });
    }
    if (!this.timeline.servesStation(station, line, this.cursor)) return edges;
    for (const other of this.linesCallingAt(station)) {
      if (other !== line) edges.push({ to: this.placeOf(station, other), minutes: CHANGE_MINUTES + this.penalty, move: { kind: 'change' } });
    }
    for (const linked of this.index.transfersAt(station)) {
      for (const other of this.linesCallingAt(linked))
        edges.push({ to: this.placeOf(linked, other), minutes: WALK_MINUTES + this.penalty, move: { kind: 'walk' } });
    }
    return edges;
  }

  /**
   * The route a search found, from the end back to the start: a ride per line, a walk per transfer.
   *
   * @param end - The place it ended at.
   * @param arrivals - How each place on the way was reached.
   * @returns The route.
   */
  private routeOf(end: Place, arrivals: Map<Place, { from: Place; move: Move }>): Route {
    const path: { place: Place; move: Move | null }[] = [];
    for (let place: Place | undefined = end; place !== undefined; place = arrivals.get(place)?.from) {
      path.unshift({ place, move: arrivals.get(place)?.move ?? null });
    }
    const legs = this.legsOf(path);
    const rides = legs.filter((leg): leg is RideLeg => leg.kind === 'ride');
    // A change at one station is between two rides; a walk counts its own minutes.
    const changesInPlace = legs.filter((leg, position) => leg.kind === 'ride' && legs[position - 1]?.kind === 'ride').length;
    return {
      legs,
      minutes: legs.reduce((total, leg) => total + leg.minutes, 0) + changesInPlace * CHANGE_MINUTES,
      km: rides.reduce((total, leg) => total + leg.km, 0),
      // A walk on its own changes nothing.
      changes: Math.max(0, rides.length - 1),
    };
  }

  /**
   * Puts the places a route goes through into legs.
   *
   * @param path - The places from start to end, each with how it was reached (none for the first).
   * @returns The legs.
   */
  private legsOf(path: { place: Place; move: Move | null }[]): RouteLeg[] {
    const legs: RouteLeg[] = [];
    let ride: RideLeg | null = null;
    for (const { place, move } of path) {
      const { station, line } = this.partsOf(place);
      if (move?.kind === 'ride' && ride) {
        ride.segments.push(move.segment);
        ride.km += move.km;
        ride.minutes += this.rideMinutes(move.km);
        if (this.timeline.servesStation(station, line, this.cursor)) ride.stops.push(station);
        continue;
      }
      if (ride) legs.push(ride);
      if (move?.kind === 'walk') legs.push({ kind: 'walk', from: ride?.stops[ride.stops.length - 1] ?? station, to: station, minutes: WALK_MINUTES });
      ride = { kind: 'ride', line, stops: [station], segments: [], km: 0, minutes: 0 };
    }
    if (ride) legs.push(ride);
    // A ride with no track is a line boarded only to change off it, at the start or the end: nothing to show.
    return legs.filter(leg => leg.kind === 'walk' || leg.segments.length > 0);
  }

  /**
   * The lines that call at a station on the date.
   *
   * @param station - The station.
   * @returns Their ids.
   */
  private linesCallingAt(station: string): string[] {
    const calling = this.index
      .lineSegmentsAt(station)
      .filter(lineSegment => this.timeline.isOpen(lineSegment, this.cursor) && this.timeline.servesStation(station, lineSegment.line, this.cursor));
    return [...new Set(calling.map(lineSegment => lineSegment.line))];
  }

  /**
   * Minutes to ride so far.
   *
   * @param km - How far.
   * @returns The minutes.
   */
  private rideMinutes(km: number): number {
    return (km / RIDE_KMH) * 60;
  }

  /**
   * A place: a station on a line.
   *
   * @param station - The station.
   * @param line - The line.
   * @returns The place.
   */
  private placeOf(station: string, line: string): Place {
    return `${station}|${line}`;
  }

  /**
   * A place's station and line.
   *
   * @param place - The place.
   * @returns Its station and line.
   */
  private partsOf(place: Place): { station: string; line: string } {
    const split = place.indexOf('|');
    return { station: place.slice(0, split), line: place.slice(split + 1) };
  }
}
