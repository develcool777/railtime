import type { LineInfo, NetworkChoice } from '@railtime/network/facts.types';

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
 * The Lines panel's groups: each network's lines in the network's order, those hidden after them,
 * only named; a network with every line hidden after those with any shown; a plan's own lines under
 * "Planned". A search keeps the lines it finds, and the groups with any.
 *
 * @param lines - The lines on the map.
 * @param choices - Each network with the lines that may be shown or hidden.
 * @param query - What was typed in the search.
 * @returns The groups, in order.
 */
export const lineGroups = (lines: LineInfo[], choices: NetworkChoice[], query: string): LineGroup[] => {
  const wanted = foldName(query);
  const found = (name: string) => !wanted || foldName(name).includes(wanted);
  const groups = new Map<string, LineGroup>();
  const choiceOf = new Map(choices.map(choice => [choice.id, choice]));
  const groupOf = (network: string, name: string): LineGroup => {
    const group = groups.get(network) ?? {
      network,
      name,
      lines: [],
      hiddenLines: [],
      toggleable: choiceOf.get(network)?.lines.map(line => line.id) ?? [],
    };
    groups.set(network, group);
    return group;
  };
  for (const line of lines) {
    if (!found(line.name)) continue;
    // A plan's own lines come under their own heading, whatever brand they would run as.
    const planned = line.opened === null;
    groupOf(planned ? 'planned' : line.network, planned ? 'Planned' : line.networkName).lines.push(line);
  }
  // Planned last, after any network with every line hidden.
  const planned = groups.get('planned');
  groups.delete('planned');
  for (const choice of choices) {
    const hidden = choice.lines.filter(line => !line.shown && found(line.name));
    if (hidden.length > 0) groupOf(choice.id, choice.name).hiddenLines.push(...hidden);
  }
  return [...groups.values(), ...(planned ? [planned] : [])];
};
