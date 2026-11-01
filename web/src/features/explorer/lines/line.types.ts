import type { LineInfo, OptionalNetworkInfo } from '@railtime/network/facts.types';

/** The Lines panel's lines under one network, or under "Planned" for a plan's own. */
export type LineGroup = {
  /** The network's id; `planned` for a plan's own lines. */
  network: string;
  name: string;
  /** A network beside the city's own, turned on or off whole. */
  optional: boolean;
  /** Whether it is on the map: always, but for an optional network turned off. */
  shown: boolean;
  /** Its lines on the map. */
  lines: LineInfo[];
  /** An optional network's lines while it is off: only named, none on the map. */
  offLines: OptionalNetworkInfo['lines'];
};
