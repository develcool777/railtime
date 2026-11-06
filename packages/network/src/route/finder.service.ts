import { pushTo } from '@railtime/core/collection.utils';
import { required } from '@railtime/core/required.utils';
import type { LineId, StationId } from '@railtime/schema/network.types';
import {
  ALTERNATIVE_EXTRA_MINUTES,
  ALTERNATIVE_SEARCHES,
  ALTERNATIVE_SLOWER,
  CHANGE_MINUTES,
  FEWER_CHANGES_PENALTY,
  SEGMENT_PENALTY_FACTOR,
  ROUTE_OPTIONS,
  WALK_MINUTES,
} from './finder.constants.ts';
import type { Arrival, Edge, Move, Place, RideLeg, Rides, Route, RouteLeg, SearchTerms, TimedHop } from './finder.types';
import type { NetworkIndex } from '../engine/index.service';
import { lineHops } from '../engine/lineDetails.utils.ts';
import type { Timeline } from '../engine/timeline.service';
import { rideSeconds } from '../trains/motion.utils.ts';
import { TRAIN_PROFILES } from '../trains/trains.constants.ts';

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
    // Both are positions the caller took from the heap.
    const held = required(this.entries[first], 'a place in the heap');
    this.entries[first] = required(this.entries[second], 'a place in the heap');
    this.entries[second] = held;
  }
}

/**
 * Finds the ways from one station to another on the network of a date, with Dijkstra's shortest
 * path. Its graph's nodes are places, each a stop on a line as the map draws it, so lines drawn as one
 * are one line to ride, with no change between them. Riding on to the next stop costs what it takes the
 * line's trains (`TRAIN_PROFILES`, `rideSeconds`, as a timetable works it out), the way they go;
 * changing line at a station or walking a transfer a few more. The options are the fastest route, the one that
 * changes least, and others found as a journey planner finds them, by the penalty method: each search
 * again costs the track the ways found ride a little more, until another way is the cheapest. Each search is told what it is of (`SearchTerms`); the finder keeps nothing between them.
 */
export class RouteFinder {
  /** The network. */
  private readonly index: NetworkIndex;
  /** When each line opened, closed and called where. */
  private readonly timeline: Timeline;
  /** Every place made so far, by station, then line: one object each, as a map keys by it. */
  private readonly places = new Map<StationId, Map<LineId, Place>>();

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
  public options(from: StationId, to: StationId, cursor: number): Route[] {
    if (from === to) return [];
    const rides = this.ridesAt(cursor);
    const fastest = this.best(from, to, { cursor, rides, penalty: 0, weights: new Map() });
    if (!fastest) return [];
    const found = [fastest];
    const keep = (route: Route | null, slowest: number) => {
      if (!route || route.minutes > slowest || found.some(other => ridesAlike(other, route))) return;
      const lines = linesRidden(route);
      if (new Set(lines).size === lines.length) found.push(route);
    };
    // The penalty already holds it to a change saved for so many minutes more.
    keep(this.best(from, to, { cursor, rides, penalty: FEWER_CHANGES_PENALTY, weights: new Map() }), Infinity);
    const slowest = fastest.minutes * ALTERNATIVE_SLOWER + ALTERNATIVE_EXTRA_MINUTES;
    const weights = new Map<number, number>();
    for (let search = 0; search < ALTERNATIVE_SEARCHES && found.length < ROUTE_OPTIONS; search++) {
      for (const segment of found.flatMap(route => route.legs.flatMap(leg => (leg.kind === 'ride' ? leg.segments : []))))
        weights.set(segment, (weights.get(segment) ?? 1) * SEGMENT_PENALTY_FACTOR);
      keep(this.best(from, to, { cursor, rides, penalty: 0, weights }), slowest);
    }
    return found.toSorted((first, second) => first.minutes - second.minutes);
  }

  /**
   * How long the fastest routes take from one station to every other the network of a date reaches:
   * the search `options` makes, run to the end.
   *
   * @param from - The station to start at.
   * @param cursor - The cursor: the network as it was then.
   * @returns Minutes to each station reached, by id, the start's 0; none if no line calls at the start.
   */
  public reach(from: StationId, cursor: number): Map<StationId, number> {
    const minutes = new Map<StationId, number>();
    this.explore(from, { cursor, rides: this.ridesAt(cursor), penalty: 0, weights: new Map() }, ({ station }, cost) => {
      // Places come off the queue soonest first: the first at a station is its time.
      if (!minutes.has(station)) minutes.set(station, cost);
      return false;
    });
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
  private best(from: StationId, to: StationId, terms: SearchTerms): Route | null {
    const { end, arrivals } = this.explore(from, terms, ({ station }) => station === to);
    return end && this.routeOf(end, arrivals);
  }

  /**
   * Dijkstra's search, from every line calling at the start, each place soonest first, until told it
   * has arrived, or nothing is left.
   *
   * @param from - The station to start at.
   * @param terms - The date, and what a change and each line cost.
   * @param arrived - Takes each place as the search settles it, and its cost; true ends the search.
   * @returns The place it ended at, if one did, and how each place on the way was reached.
   */
  private explore(from: StationId, terms: SearchTerms, arrived: (place: Place, cost: number) => boolean): { end: Place | null; arrivals: Map<Place, Arrival> } {
    const best = new Map<Place, number>();
    const arrivals = new Map<Place, Arrival>();
    const queue = new PriorityQueue<Place>();
    for (const line of this.timeline.linesCallingAt(from, terms.cursor)) {
      best.set(this.placeOf(from, line), 0);
      queue.push(this.placeOf(from, line), 0);
    }
    for (let next = queue.pop(); next; next = queue.pop()) {
      const { item: place, cost } = next;
      // An entry left behind by a cheaper way found later.
      if (cost > (best.get(place) ?? Infinity)) continue;
      if (arrived(place, cost)) return { end: place, arrivals };
      for (const edge of this.edgesFrom(place, terms)) {
        const total = cost + edge.minutes;
        if (total >= (best.get(edge.to) ?? Infinity)) continue;
        best.set(edge.to, total);
        arrivals.set(edge.to, { from: place, move: edge.move });
        queue.push(edge.to, total);
      }
    }
    return { end: null, arrivals };
  }

  /**
   * Where one can go from a place: on to the next stop, the way the line's trains go, to another line
   * at the station, or on foot to a station a transfer links.
   *
   * @param place - The place.
   * @param terms - The date, and what a change and each line cost.
   * @returns The edges out of it.
   */
  private edgesFrom(place: Place, terms: SearchTerms): Edge[] {
    const { cursor, rides, penalty, weights } = terms;
    const { station, line } = place;
    const edges: Edge[] = [];
    for (const hop of rides.get(line)?.get(station) ?? []) {
      const weight = Math.max(...hop.segments.map(segment => weights.get(segment) ?? 1));
      edges.push({ to: this.placeOf(hop.to, line), minutes: hop.minutes * weight, move: { kind: 'ride', hop } });
    }
    for (const other of this.timeline.linesCallingAt(station, cursor)) {
      if (other !== line) edges.push({ to: this.placeOf(station, other), minutes: CHANGE_MINUTES + penalty, move: { kind: 'change' } });
    }
    for (const linked of this.index.transfersAt(station)) {
      for (const other of this.timeline.linesCallingAt(linked, cursor))
        edges.push({ to: this.placeOf(linked, other), minutes: WALK_MINUTES + penalty, move: { kind: 'walk' } });
    }
    return edges;
  }

  /**
   * The rides from every stop at a cursor, each timed as its own line's trains run it, from the train
   * coming to the stop to its coming to the next: what a timetable says between the two. Lines the map
   * draws as one are one line to ride, each hop keeping its own line's time.
   *
   * @param cursor - The cursor: the network as it was then.
   * @returns The rides.
   */
  private ridesAt(cursor: number): Rides {
    const rides: Rides = new Map();
    for (const line of this.index.lineIds) {
      const profile = TRAIN_PROFILES[this.index.lineOf(line).mode];
      const drawn = this.timeline.drawnAs(line, cursor);
      const byStop = rides.get(drawn) ?? new Map<StationId, TimedHop[]>();
      rides.set(drawn, byStop);
      for (const [stop, hops] of lineHops(this.index, this.timeline, line, cursor))
        for (const hop of hops) pushTo(byStop, stop, { ...hop, minutes: (profile.standSeconds + rideSeconds(profile, hop.km)) / 60 });
    }
    return rides;
  }

  /**
   * The route a search found, from the end back to the start: a ride per line, a walk per transfer.
   *
   * @param end - The place it ended at.
   * @param arrivals - How each place on the way was reached.
   * @returns The route.
   */
  private routeOf(end: Place, arrivals: Map<Place, Arrival>): Route {
    // Gathered from the end back, then turned round: an `unshift` would copy the path at every place.
    const backwards: { place: Place; move: Move | null }[] = [];
    for (let place: Place | undefined = end; place !== undefined; place = arrivals.get(place)?.from) {
      backwards.push({ place, move: arrivals.get(place)?.move ?? null });
    }
    const legs = this.legsOf(backwards.toReversed());
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
      const { station, line } = place;
      if (move?.kind === 'ride' && ride) {
        ride.segments.push(...move.hop.segments);
        ride.km += move.hop.km;
        ride.minutes += move.hop.minutes;
        ride.stops.push(station);
        continue;
      }
      if (ride) legs.push(ride);
      if (move?.kind === 'walk') legs.push({ kind: 'walk', from: ride?.stops.at(-1) ?? station, to: station, minutes: WALK_MINUTES });
      ride = { kind: 'ride', line, stops: [station], segments: [], km: 0, minutes: 0 };
    }
    if (ride) legs.push(ride);
    // A ride with no track is a line boarded only to change off it, at the start or the end: nothing to show.
    return legs.filter(leg => leg.kind === 'walk' || leg.segments.length > 0);
  }

  /**
   * A place: a station on a line, the same object each time it is asked for.
   *
   * @param station - The station.
   * @param line - The line.
   * @returns The place.
   */
  private placeOf(station: StationId, line: LineId): Place {
    const byLine = this.places.get(station) ?? new Map<LineId, Place>();
    this.places.set(station, byLine);
    const known = byLine.get(line);
    if (known) return known;
    const place = { station, line };
    byLine.set(line, place);
    return place;
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
