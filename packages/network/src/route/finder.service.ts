import type { NetworkIndex } from '../engine/index.service';
import type { Edge, Move, Place, RideLeg, Route, RouteLeg, SearchTerms } from './finder.types';
import type { Timeline } from '../engine/timeline.service';
import {
  ALTERNATIVE_EXTRA_MINUTES,
  ALTERNATIVE_SEARCHES,
  ALTERNATIVE_SLOWER,
  CHANGE_MINUTES,
  FEWER_CHANGES_PENALTY,
  RIDE_KMH,
  SEGMENT_PENALTY_FACTOR,
  ROUTE_OPTIONS,
  WALK_MINUTES,
} from './finder.constants.ts';

/**
 * A binary min-heap: items come out cheapest first. What Dijkstra's search takes its next place
 * from, in log time.
 */
export class PriorityQueue<Item> {
  /** The items with their costs, as a heap: each parent costs no more than its children. */
  private readonly entries: { cost: number; item: Item }[] = [];

  /** How many items wait. */
  public get size(): number {
    return this.entries.length;
  }

  /**
   * Adds an item.
   *
   * @param item - The item.
   * @param cost - Its cost: the cheapest comes out first.
   */
  public push(item: Item, cost: number): void {
    this.entries.push({ cost, item });
    let child = this.entries.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (this.costAt(parent) <= this.costAt(child)) break;
      this.swap(parent, child);
      child = parent;
    }
  }

  /**
   * Takes the cheapest item out.
   *
   * @returns It and its cost, or `undefined` when empty.
   */
  public pop(): { cost: number; item: Item } | undefined {
    const top = this.entries[0];
    const last = this.entries.pop();
    if (!top || !last || this.entries.length === 0) return top;
    this.entries[0] = last;
    let parent = 0;
    while (parent * 2 + 1 < this.entries.length) {
      const left = parent * 2 + 1;
      const cheaper = left + 1 < this.entries.length && this.costAt(left + 1) < this.costAt(left) ? left + 1 : left;
      if (this.costAt(parent) <= this.costAt(cheaper)) break;
      this.swap(parent, cheaper);
      parent = cheaper;
    }
    return top;
  }

  /**
   * The cost of the entry at a position.
   *
   * @param position - A position in the heap.
   * @returns Its cost.
   */
  private costAt(position: number): number {
    return this.entries[position]?.cost ?? Infinity;
  }

  /**
   * Swaps two entries.
   *
   * @param first - A position in the heap.
   * @param second - Another.
   */
  private swap(first: number, second: number): void {
    // Within bounds: both are positions the caller took from the heap.
    [this.entries[first], this.entries[second]] = [this.entries[second]!, this.entries[first]!];
  }
}

/**
 * Finds the ways from one station to another on the network of a date, with Dijkstra's shortest
 * path. Its graph's nodes are places, each a station on a line: riding a segment costs the minutes the
 * track takes, changing line at a station or walking a transfer a few more. A line passes a station it
 * does not call at, but no one gets on or off there. The options are the fastest route, the one that
 * changes least, and others found as a journey planner finds them, by the penalty method: each search
 * again costs the track the ways found ride a little more, until another way is the cheapest. Each search is told what it is of (`SearchTerms`); the finder keeps nothing between them.
 */
export class RouteFinder {
  /** The network. */
  private readonly index: NetworkIndex;
  /** When each line opened, closed and called where. */
  private readonly timeline: Timeline;

  public constructor(index: NetworkIndex, timeline: Timeline) {
    this.index = index;
    this.timeline = timeline;
  }

  /**
   * The ways between two stations, up to `ROUTE_OPTIONS`, fastest first: the fastest route; the one
   * that changes least, if another; then, up to `ALTERNATIVE_SEARCHES` times, the cheapest with the
   * track the ways found ride costing `SEGMENT_PENALTY_FACTOR` times more for each, kept while it
   * rides other lines than every way found, no line twice (off a line and back on it is a detour, not
   * a way), and is not much slower than the fastest (`ALTERNATIVE_SLOWER`, `ALTERNATIVE_EXTRA_MINUTES`).
   *
   * @param from - The station to start at.
   * @param to - The station to get to.
   * @param cursor - The cursor: the network as it was then.
   * @returns The routes, fastest first; none if there is no way (or the two are the same station).
   */
  public options(from: string, to: string, cursor: number): Route[] {
    if (from === to) return [];
    const fastest = this.best(from, to, { cursor, penalty: 0, weights: new Map() });
    if (!fastest) return [];
    const found = [fastest];
    const keep = (route: Route | null, slowest: number) => {
      if (!route || route.minutes > slowest || found.some(other => ridesAlike(other, route))) return;
      const lines = linesRidden(route);
      if (new Set(lines).size === lines.length) found.push(route);
    };
    // The penalty already holds it to a change saved for so many minutes more.
    keep(this.best(from, to, { cursor, penalty: FEWER_CHANGES_PENALTY, weights: new Map() }), Infinity);
    const slowest = fastest.minutes * ALTERNATIVE_SLOWER + ALTERNATIVE_EXTRA_MINUTES;
    const weights = new Map<number, number>();
    for (let search = 0; search < ALTERNATIVE_SEARCHES && found.length < ROUTE_OPTIONS; search++) {
      for (const segment of found.flatMap(route => route.legs.flatMap(leg => (leg.kind === 'ride' ? leg.segments : []))))
        weights.set(segment, (weights.get(segment) ?? 1) * SEGMENT_PENALTY_FACTOR);
      keep(this.best(from, to, { cursor, penalty: 0, weights }), slowest);
    }
    return found.sort((first, second) => first.minutes - second.minutes);
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
    const terms: SearchTerms = { cursor, penalty: 0, weights: new Map() };
    const minutes = new Map<string, number>();
    const best = new Map<Place, number>();
    const queue = new PriorityQueue<Place>();
    for (const line of this.linesCallingAt(from, cursor)) {
      best.set(this.placeOf(from, line), 0);
      queue.push(this.placeOf(from, line), 0);
    }
    for (let next = queue.pop(); next; next = queue.pop()) {
      const { item: place, cost } = next;
      if (cost > (best.get(place) ?? Infinity)) continue;
      const { station, line } = this.partsOf(place);
      // Places come off the queue soonest first: the first a line calls at is the station's time.
      if (!minutes.has(station) && this.timeline.servesStation(station, line, cursor)) minutes.set(station, cost);
      for (const edge of this.edgesFrom(place, terms)) {
        const total = cost + edge.minutes;
        if (total >= (best.get(edge.to) ?? Infinity)) continue;
        best.set(edge.to, total);
        queue.push(edge.to, total);
      }
    }
    return minutes;
  }

  /**
   * The best route between two stations, as a search costs it.
   *
   * @param from - The station to start at.
   * @param to - The station to get to.
   * @param terms - The date, and what a change and each line cost.
   * @returns The route, or `null` if there is none.
   */
  private best(from: string, to: string, terms: SearchTerms): Route | null {
    const reached = this.search(from, to, terms);
    return reached && this.routeOf(reached.place, reached.arrivals, terms.cursor);
  }

  /**
   * Dijkstra's search, from every line calling at the start until a line calling at the end.
   *
   * @param from - The station to start at.
   * @param to - The station to get to.
   * @param terms - The date, and what a change and each line cost.
   * @returns The place it ended at, and how each place on the way was reached; `null` if it was not.
   */
  private search(from: string, to: string, terms: SearchTerms): { place: Place; arrivals: Map<Place, { from: Place; move: Move }> } | null {
    const best = new Map<Place, number>();
    const arrivals = new Map<Place, { from: Place; move: Move }>();
    const queue = new PriorityQueue<Place>();
    for (const line of this.linesCallingAt(from, terms.cursor)) {
      best.set(this.placeOf(from, line), 0);
      queue.push(this.placeOf(from, line), 0);
    }
    for (let next = queue.pop(); next; next = queue.pop()) {
      const { item: place, cost } = next;
      // An entry left behind by a cheaper way found later.
      if (cost > (best.get(place) ?? Infinity)) continue;
      const { station, line } = this.partsOf(place);
      if (station === to && this.timeline.servesStation(station, line, terms.cursor)) return { place, arrivals };
      for (const edge of this.edgesFrom(place, terms)) {
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
   * @param terms - The date, and what a change and each line cost.
   * @returns The edges out of it.
   */
  private edgesFrom(place: Place, terms: SearchTerms): Edge[] {
    const { cursor, penalty, weights } = terms;
    const { station, line } = this.partsOf(place);
    const edges: Edge[] = [];
    for (const lineSegment of this.index.lineSegmentsAt(station)) {
      if (lineSegment.line !== line || !this.timeline.isOpen(lineSegment, cursor)) continue;
      const { segment } = lineSegment;
      const next = segment.stationA === station ? segment.stationB : segment.stationA;
      edges.push({
        to: this.placeOf(next, line),
        minutes: this.rideMinutes(segment.lengthKm) * (weights.get(segment.index) ?? 1),
        move: { kind: 'ride', segment: segment.index, km: segment.lengthKm },
      });
    }
    if (!this.timeline.servesStation(station, line, cursor)) return edges;
    for (const other of this.linesCallingAt(station, cursor)) {
      if (other !== line) edges.push({ to: this.placeOf(station, other), minutes: CHANGE_MINUTES + penalty, move: { kind: 'change' } });
    }
    for (const linked of this.index.transfersAt(station)) {
      for (const other of this.linesCallingAt(linked, cursor))
        edges.push({ to: this.placeOf(linked, other), minutes: WALK_MINUTES + penalty, move: { kind: 'walk' } });
    }
    return edges;
  }

  /**
   * The route a search found, from the end back to the start: a ride per line, a walk per transfer.
   *
   * @param end - The place it ended at.
   * @param arrivals - How each place on the way was reached.
   * @param cursor - The date searched: which stations its lines call at.
   * @returns The route.
   */
  private routeOf(end: Place, arrivals: Map<Place, { from: Place; move: Move }>, cursor: number): Route {
    const path: { place: Place; move: Move | null }[] = [];
    for (let place: Place | undefined = end; place !== undefined; place = arrivals.get(place)?.from) {
      path.unshift({ place, move: arrivals.get(place)?.move ?? null });
    }
    const legs = this.legsOf(path, cursor);
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
   * @param cursor - The date searched: which stations its lines call at.
   * @returns The legs.
   */
  private legsOf(path: { place: Place; move: Move | null }[], cursor: number): RouteLeg[] {
    const legs: RouteLeg[] = [];
    let ride: RideLeg | null = null;
    for (const { place, move } of path) {
      const { station, line } = this.partsOf(place);
      if (move?.kind === 'ride' && ride) {
        ride.segments.push(move.segment);
        ride.km += move.km;
        ride.minutes += this.rideMinutes(move.km);
        if (this.timeline.servesStation(station, line, cursor)) ride.stops.push(station);
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
   * @param cursor - The date.
   * @returns Their ids.
   */
  private linesCallingAt(station: string, cursor: number): string[] {
    const calling = this.index
      .lineSegmentsAt(station)
      .filter(lineSegment => this.timeline.isOpen(lineSegment, cursor) && this.timeline.servesStation(station, lineSegment.line, cursor));
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

/**
 * The lines a route rides, in order.
 *
 * @param route - The route.
 * @returns Their ids.
 */
const linesRidden = (route: Route): string[] => route.legs.flatMap(leg => (leg.kind === 'ride' ? [leg.line] : []));

/**
 * Whether two routes ride the same lines in the same order, walks aside: the same way, whatever station
 * they change at.
 *
 * @param first - One route.
 * @param second - The other.
 * @returns True if they do.
 */
const ridesAlike = (first: Route, second: Route): boolean => linesRidden(first).join('|') === linesRidden(second).join('|');
