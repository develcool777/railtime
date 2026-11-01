import type { LineInfo, OptionalNetworkInfo } from '@railtime/network/facts.types';

import type { LineGroup } from '~/features/explorer/lines/line.types';
import { foldName } from '~/features/explorer/stations/station.utils';

/**
 * A change's title inside its line's own view, where the line's name goes without saying:
 * "Red line extended" reads "Extended", "Red line: section closes" reads "Section closes". A title
 * that does not start with the line's name (a station opening on it) stays as it is.
 *
 * @param title - The change's title, as the timeline gives it.
 * @param lineName - The line's name, with or without " line" after it in the title.
 * @returns The title without the line's name, its first letter capital.
 */
export const titleInLine = (title: string, lineName: string): string => {
  const escaped = lineName.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const rest = title.replace(new RegExp(`^${escaped}(?: line)?:? `), '');
  return rest === title ? title : rest.charAt(0).toUpperCase() + rest.slice(1);
};

/**
 * The Lines panel's groups: each network's lines in the network's order, a plan's own lines under
 * "Planned", then each optional network turned off, with its lines only named. A search keeps the lines
 * it finds, and the groups with any.
 *
 * @param lines - The lines on the map.
 * @param optional - The networks the city may show or leave off.
 * @param query - What was typed in the search.
 * @returns The groups, in order.
 */
export const lineGroups = (lines: LineInfo[], optional: OptionalNetworkInfo[], query: string): LineGroup[] => {
  const wanted = foldName(query);
  const found = (name: string) => !wanted || foldName(name).includes(wanted);
  const optionalIds = new Set(optional.map(network => network.id));
  const groups = new Map<string, LineGroup>();
  for (const line of lines) {
    if (!found(line.name)) continue;
    // A plan's own lines come under their own heading, whatever brand they would run as.
    const planned = line.opened === null;
    const network = planned ? 'planned' : line.network;
    const group = groups.get(network) ?? {
      network,
      name: planned ? 'Planned' : line.networkName,
      optional: !planned && optionalIds.has(network),
      shown: true,
      lines: [],
      offLines: [],
    };
    group.lines.push(line);
    groups.set(network, group);
  }
  for (const network of optional) {
    const offLines = network.shown ? [] : network.lines.filter(line => found(line.name));
    if (offLines.length > 0) groups.set(network.id, { network: network.id, name: network.name, optional: true, shown: false, lines: [], offLines });
  }
  return [...groups.values()];
};
