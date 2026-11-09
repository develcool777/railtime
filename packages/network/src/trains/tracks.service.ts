import { firstDifference, pushTo } from '@railtime/core/collection.utils';
import { required } from '@railtime/core/required.utils';
import { byCodeUnits } from '@railtime/core/text.utils';
import type { LineId } from '@railtime/schema/network.types';
import { CYCLE_SECONDS, SAME_MOMENT_SECONDS, TRAIN_PROFILES } from './trains.constants.ts';
import type { Bottleneck, Conflict, Departures, Meeting, Passing, Ride, TrackRoom } from './trains.types';
import { clearanceAt, isLoop, meetingsOf, nearestClearTo, roomsOf, turnSecondsOf, withinCycle } from './trains.utils.ts';

/**
 * The network's tracks as a timetable fills them, as an operator fills them. Each route runs as often as
 * its kind does, where its tracks have room; where a track has not, its routes share it. Then the
 * busiest are placed first, each train setting out as near its even time as it can, clear of every train
 * already on each track it takes, whichever line's, as signals keep them. The routes' trains are only
 * when they set out: how they turn at the ends, and so how many there are, is the trains' own.
 */
export class TrackTimetable {
  /** Each route's ride. */
  private readonly rides: readonly Ride[];
  /** Where each route's trains meet others, each way; none back on a loop run one way. */
  private readonly meetings: { out: Meeting[]; back: Meeting[] }[];
  /** Each place's room, and the routes on it. */
  private readonly rooms: Map<string, TrackRoom>;
  /** How many trains a cycle each route runs, each way. */
  private readonly frequencies: number[];
  /** Every train placed so far, by where it passes. */
  private readonly placed = new Map<string, Passing[]>();
  /** When each route's trains set out, in the order the routes were given. */
  public readonly departures: Departures[];

  /**
   * @param rides - Each route's ride.
   */
  public constructor(rides: readonly Ride[]) {
    this.rides = rides;
    this.meetings = rides.map(ride => ({ out: meetingsOf(ride, 1), back: isLoop(ride.run) && ride.run.oneWay ? [] : meetingsOf(ride, -1) }));
    this.rooms = roomsOf(this.meetings.map(({ out, back }) => [...out, ...back]));
    this.frequencies = this.shared();
    const departures = new Map<number, Departures>();
    for (const route of this.busiestFirst()) departures.set(route, this.departuresOf(route));
    this.departures = rides.map((_ride, route) => departures.get(route) ?? { out: [], back: [] });
  }

  /**
   * How many trains a cycle each route runs: what its kind would, where its tracks have room for every
   * route's; where one has not, the routes on it share its room evenly, each as many as fit, and at least
   * one. Shared fairly, as signals share a track: the tightest place first, the routes asking less than
   * an even share there keeping what they ask, the rest of its room to the others; then what room whole
   * trains leave goes a train at a time where it fits.
   *
   * @returns How many each runs, in the order of the routes.
   */
  private shared(): number[] {
    const wanted = this.rides.map(({ run }) => CYCLE_SECONDS / TRAIN_PROFILES[run.mode].headwaySeconds);
    const settled = new Map<number, number>();
    while (settled.size < wanted.length) {
      const { share, tightest } = this.tightestShare(settled);
      const content = [...wanted.entries()].filter(([route, asks]) => !settled.has(route) && asks <= share);
      for (const [route, asks] of content) settled.set(route, asks);
      if (content.length > 0) continue;
      for (const route of tightest) settled.set(route, Math.max(1, Math.floor(share)));
    }
    this.fillRoomLeft(wanted, settled);
    return wanted.map((_asks, route) => settled.get(route) ?? 0);
  }

  /**
   * The place with the least room left for each of the routes on it not yet settled, and that room.
   *
   * @param settled - How many trains a cycle each route settled so far runs.
   * @returns The even share there, and its routes not yet settled.
   */
  private tightestShare(settled: ReadonlyMap<number, number>): { share: number; tightest: number[] } {
    let share = Infinity;
    let tightest: number[] = [];
    for (const { room, routes } of this.rooms.values()) {
      const open = routes.filter(route => !settled.has(route));
      if (open.length === 0) continue;
      let taken = 0;
      for (const route of routes) taken += settled.get(route) ?? 0;
      const even = (room - taken) / open.length;
      if (even >= share) continue;

      share = even;
      tightest = open;
    }
    return { share, tightest };
  }

  /**
   * Gives what room whole trains leave on each track, a train at a time, to a route it fits on all its
   * tracks: of the line running fewest trains, then the route running fewest, until none fits.
   *
   * @param wanted - How many trains a cycle each route would run.
   * @param settled - How many each runs: added to.
   */
  private fillRoomLeft(wanted: readonly number[], settled: Map<number, number>): void {
    const roomsOfRoute = new Map<number, TrackRoom[]>();
    for (const room of this.rooms.values()) for (const route of room.routes) pushTo(roomsOfRoute, route, room);
    const nextFewest = (): number | undefined => {
      const taken = new Map<TrackRoom, number>();
      for (const room of this.rooms.values()) {
        let trains = 0;
        for (const route of room.routes) trains += settled.get(route) ?? 0;
        taken.set(room, trains);
      }
      const lines = new Map<LineId, number>();
      for (const [route, { run }] of this.rides.entries()) lines.set(run.line, (lines.get(run.line) ?? 0) + (settled.get(route) ?? 0));
      const lineTrains = (route: number): number => lines.get(this.rideOf(route).run.line) ?? 0;
      const fits = (route: number): boolean => (roomsOfRoute.get(route) ?? []).every(room => (taken.get(room) ?? 0) + 1 <= room.room);
      return [...wanted.keys()]
        .filter(route => (settled.get(route) ?? 0) < (wanted[route] ?? 0) && fits(route))
        .toSorted((first, second) =>
          firstDifference(lineTrains(first) - lineTrains(second), (settled.get(first) ?? 0) - (settled.get(second) ?? 0), first - second),
        )[0];
    };
    for (let route = nextFewest(); route !== undefined; route = nextFewest()) settled.set(route, (settled.get(route) ?? 0) + 1);
  }

  /**
   * The routes in the order they are placed: the busiest first, as an operator gives way; of those as
   * busy, the one meeting the most others' trains, which has the fewest paths clear of them.
   *
   * @returns Each route, by its place among the routes.
   */
  private busiestFirst(): number[] {
    const trains = (route: number) => this.frequencies[route] ?? 0;
    const met = new Map<number, number>();
    for (const { routes } of this.rooms.values()) {
      let passing = 0;
      for (const route of routes) passing += trains(route);
      for (const route of routes) met.set(route, (met.get(route) ?? 0) + passing - trains(route));
    }
    return [...this.rides.keys()].toSorted((first, second) =>
      firstDifference(
        trains(second) - trains(first),
        (met.get(second) ?? 0) - (met.get(first) ?? 0),
        byCodeUnits(this.rideOf(first).run.line, this.rideOf(second).run.line),
        first - second,
      ),
    );
  }

  /**
   * When a route's trains set out: out evenly through the cycle, in turn with the routes they share their
   * busiest track with, and each back as soon as it has turned at the far end; a loop's each way evenly,
   * each its own trains. Each as near that as is clear of every train already placed.
   *
   * @param route - The route, by its place among the routes.
   * @returns When they set out.
   */
  private departuresOf(route: number): Departures {
    const ride = this.rideOf(route);
    const { out, back } = this.meetings[route] ?? { out: [], back: [] };
    const trains = this.frequencies[route] ?? 0;
    const outward = this.near(out, this.evenTimes(out, trains));
    if (isLoop(ride.run)) return { out: outward, back: back.length === 0 ? [] : this.near(back, this.evenTimes(back, trains)) };
    const turned = turnSecondsOf(ride.run);
    return {
      out: outward,
      back: this.near(
        back,
        outward.map(departure => departure + ride.seconds + turned),
      ),
    };
  }

  /**
   * A route's trains one way, each setting out as near as it may to when it would, clear of every train
   * already placed where they meet, and placed in turn.
   *
   * @param meetings - Where its trains meet others, that way.
   * @param wanted - When each would set out.
   * @returns When each sets out, within the cycle.
   */
  private near(meetings: readonly Meeting[], wanted: readonly number[]): number[] {
    return wanted.map(time => {
      const departure = nearestClearTo(time, this.conflictsOf(meetings));
      for (const { place, seconds, separation } of meetings) pushTo(this.placed, place, { seconds: withinCycle(departure + seconds), separation });
      return departure;
    });
  }

  /**
   * When a route's trains one way would set out: evenly through the cycle from its first.
   *
   * @param meetings - Where its trains meet others, that way.
   * @param trains - How many a cycle.
   * @returns The times.
   */
  private evenTimes(meetings: readonly Meeting[], trains: number): number[] {
    const first = this.firstDeparture(meetings);
    return Array.from({ length: trains }, (_unused, train) => first + (train * CYCLE_SECONDS) / trains);
  }

  /**
   * When a route's first train one way would set out: in its turn on the track it shares with the most
   * trains, a whole share of that track's cycle on from a train already on it, so the routes there come
   * evenly, as branches along a trunk do; else, as near the start of the cycle as is clear.
   *
   * @param meetings - Where its trains meet others, that way.
   * @returns When it would set out.
   */
  private firstDeparture(meetings: readonly Meeting[]): number {
    const conflicts = this.conflictsOf(meetings);
    const { place, trains } = this.bottleneckOf(meetings);
    const there = meetings.find(meeting => meeting.place === place)?.seconds ?? 0;
    const slot = CYCLE_SECONDS / trains;
    const turns = (this.placed.get(place) ?? []).flatMap(({ seconds }) =>
      Array.from({ length: trains - 1 }, (_unused, step) => withinCycle(seconds - there + (step + 1) * slot)),
    );
    return turns.find(turn => clearanceAt(turn, conflicts) >= -SAME_MOMENT_SECONDS) ?? nearestClearTo(0, conflicts);
  }

  /**
   * The place a route's trains share with the most others one way, and how many trains a cycle pass it.
   *
   * @param meetings - Where they meet others, that way.
   * @returns The place.
   */
  private bottleneckOf(meetings: readonly Meeting[]): Bottleneck {
    let busiest: Bottleneck = { place: '', trains: 1 };
    for (const { place } of meetings) {
      let trains = 0;
      for (const route of this.rooms.get(place)?.routes ?? []) trains += this.frequencies[route] ?? 0;
      if (trains > busiest.trains) busiest = { place, trains };
    }
    return busiest;
  }

  /**
   * Each time a train setting out would come too close to one already placed, somewhere they meet: both
   * held to the more cautious of their kinds' signals.
   *
   * @param meetings - Where the train meets others, one way.
   * @returns The conflicts.
   */
  private conflictsOf(meetings: readonly Meeting[]): Conflict[] {
    return meetings.flatMap(meeting =>
      (this.placed.get(meeting.place) ?? []).map(passing => ({
        center: withinCycle(passing.seconds - meeting.seconds),
        reach: Math.max(meeting.separation, passing.separation),
      })),
    );
  }

  /**
   * A route's ride.
   *
   * @param route - The route, by its place among the routes.
   * @returns Its ride.
   */
  private rideOf(route: number): Ride {
    return required(this.rides[route], 'a route among the rides');
  }
}
