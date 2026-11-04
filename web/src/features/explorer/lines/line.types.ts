import type { LineColor, LineInfo } from '@railtime/network/facts.types';
import type { LineId, NetworkId } from '@railtime/schema/network.types';

/** A line in the Lines panel: on the map, or hidden in its place, only named. */
type LineEntry = {
  id: LineId;
  name: string;
  color: LineColor;
  /** The line on the map; `null` while it is hidden. */
  shown: LineInfo | null;
};

/** The Lines panel's lines under one network, or under "Planned" for a plan's own. */
export type LineGroup = {
  /** The network's id; `planned` for a plan's own lines. */
  network: NetworkId | 'planned';
  name: string;
  /** Its lines in the network's order, hidden ones in their places: those a search finds. */
  entries: LineEntry[];
  /** Every line of it that may be shown or hidden, those the search found or not; none for a plan's own. */
  toggleable: LineId[];
};
