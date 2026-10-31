import type { LineDetails, StationInfo } from '@railtime/network/facts.types';

import { formatDay, yearOf } from '~/features/explorer/format.utils';
import type { PanelTopContent, SectionTopInput } from '~/features/explorer/panel/panel.types';

/**
 * A count with its noun, singular for one.
 *
 * @param count - How many.
 * @param noun - The noun, singular.
 * @returns "1 line", "3 lines".
 */
const counted = (count: number, noun: string): string => (count === 1 ? `1 ${noun}` : `${count} ${noun}s`);

/**
 * The top of a station's view: its name; under it, its names in other languages and the year its
 * first line called there; its lines' colours.
 *
 * @param station - The station, on the date shown.
 * @param backLabel - What the view was opened over.
 * @returns The panel's top.
 */
export const stationTop = (station: StationInfo, backLabel: string): PanelTopContent => {
  const opened = station.lines.flatMap(line => (line.opened ? [line.opened.slice(0, 4)] : [])).sort()[0];
  return {
    title: station.name,
    context: [...station.otherNames, opened ? `opened ${opened}` : 'planned'].join(' · '),
    dots: station.lines.map(line => line.color),
    backLabel,
  };
};

/**
 * The top of a line's view: its name, the year it opened and, while open, its size on the date shown.
 *
 * @param line - The line, on the date shown.
 * @param backLabel - What the view was opened over.
 * @returns The panel's top.
 */
export const lineTop = (line: LineDetails, backLabel: string): PanelTopContent => {
  const opened = line.opened === null ? 'planned' : `opened ${yearOf(line.opened)}`;
  const size = line.branches.length > 0 ? ` · ${line.stations} stations · ${Math.round(line.km)} km` : '';
  return { title: line.name, context: `${opened}${size}`, dots: [line.color], backLabel };
};

/**
 * The top of a section's own list: its name (Changes says what is playing while it plays) and its counts.
 *
 * @param input - The section, and what its counts are read from.
 * @returns The panel's top.
 */
export const sectionTop = (input: SectionTopInput): PanelTopContent => {
  const { section, playing, time, changes, currentChange } = input;
  if (section === 'lines') {
    const shown = input.lines.filter(line => input.visible.has(line.id)).length;
    return { title: input.label, context: `${counted(input.lines.length, 'line')} · ${shown} shown` };
  }
  if (section === 'stations') return { title: input.label, context: `${counted(input.stationCount, 'station')} on the map` };
  if (section === 'changes') {
    const playingTitle = input.hasPlan ? 'Playing the future' : 'Playing history';
    const title = playing ? playingTitle : input.label;
    if (playing && currentChange !== null && time)
      return { title, context: `${currentChange + 1} of ${changes.length} · ${time.future ? 'Future' : formatDay(time.time)}` };
    const first = changes.find(change => change.time !== null)?.time;
    const count = counted(changes.length, 'change');
    return { title, context: first ? `${count} since ${yearOf(first)}` : count };
  }
  if (section === 'route') return { title: input.label, context: 'Between any two stations, on the date shown' };
  if (section === 'insights') return { title: input.label, context: 'How the network grew, and its records' };
  if (section === 'reach') return { title: input.label, context: 'How far you get from a station' };
  if (section === 'coverage') return { title: input.label, context: 'How much of the city is near a station' };
  return { title: input.label, context: `${counted(input.planCount, 'plan')} drawn up` };
};
