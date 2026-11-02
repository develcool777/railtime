import type { LineInfo, NetworkChoice } from '@railtime/network/facts.types';

/** The Lines panel's lines under one network, or under "Planned" for a plan's own. */
export type LineGroup = {
  /** The network's id; `planned` for a plan's own lines. */
  network: string;
  name: string;
  /** Its lines on the map. */
  lines: LineInfo[];
  /** Its lines hidden: only named, none on the map. */
  hiddenLines: NetworkChoice['lines'];
  /** Every line of it that may be shown or hidden, those the search found or not; none for a plan's own. */
  toggleable: string[];
};
