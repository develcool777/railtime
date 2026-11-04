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
 * The Lines panel's groups: each network's lines in the network's order, a line hidden in its place,
 * only named; a plan's own lines last, under "Planned". A search keeps the lines it finds, and the
 * groups with any.
 *
 * @param lines - The lines on the map.
 * @param choices - Each network with the lines that may be shown or hidden.
 * @param query - What was typed in the search.
 * @returns The groups, in order.
 */
export const lineGroups = (lines: LineInfo[], choices: NetworkChoice[], query: string): LineGroup[] => {
  const wanted = foldName(query);
  const found = (name: string) => !wanted || foldName(name).includes(wanted);
  const onMap = new Map(lines.map(line => [line.id, line]));
  const networks = choices.map(choice => ({
    network: choice.id,
    name: choice.name,
    entries: choice.lines
      .filter(line => found(line.name))
      .map(line => ({ id: line.id, name: line.name, color: line.color, shown: line.shown ? (onMap.get(line.id) ?? null) : null })),
    toggleable: choice.lines.map(line => line.id),
  }));
  // A plan's own lines come under their own heading, whatever brand they would run as.
  const planned = lines
    .filter(line => line.opened === null && found(line.name))
    .map(line => ({ id: line.id, name: line.name, color: line.color, shown: line }));
  return [...networks, { network: 'planned', name: 'Planned', entries: planned, toggleable: [] }].filter(group => group.entries.length > 0);
};
