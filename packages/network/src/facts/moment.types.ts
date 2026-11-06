import type { IsoDate } from '@railtime/core/date.types';
import type { LineId, StationId } from '@railtime/schema/network.types';
import type { NetworkStats } from './facts.types';
import type { NetworkIndex } from '../engine/index.service';
import type { Playheads } from '../engine/playheads.service';
import type { Timeline } from '../engine/timeline.service';
import type { RouteFinder } from '../route/finder.service';
import type { TrainService } from '../trains/trains.service';

/** What the answers at a moment draw on: the network, its history, and the search over it. */
export type MomentSource = {
  index: NetworkIndex;
  timeline: Timeline;
  playheads: Playheads;
  finder: RouteFinder;
  /** The network's size at a cursor. */
  statsAt: (cursor: number) => NetworkStats;
  /** The trains the network runs at a cursor. */
  trains: (cursor: number) => TrainService;
  /** The year each station was first on the map, worked out the first time it is asked for. */
  firstYears: () => ReadonlyMap<StationId, number>;
};

/** What the records are worked out from: the network, and its history. */
export type RecordsSource = Pick<MomentSource, 'index' | 'timeline'> & { firstYears: ReadonlyMap<StationId, number> };

/** A line's dates at a station, for the line the map draws it as at the moment. */
export type DatedLine = {
  drawn: LineId;
  /** When it opened here; `null` for a plan's line, which has no date. */
  opened: IsoDate | null;
  /** When it closed here, if it has. */
  closed: IsoDate | undefined;
};
