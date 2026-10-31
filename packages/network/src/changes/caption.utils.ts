import { DAY_MS } from '../core/date.utils';
import { required } from '../core/required.utils';
import type { StepInfo } from '../model/facts.types';
import type { CloseStep, IdentityStep, InfillStep, OpenStep, RenameStep, Step, StationCloseStep } from '../network/timeline.types';
import type { CaptionContext } from './caption.types';
import { planGrowth } from './growth.utils';

/**
 * A station's name on a step's date.
 *
 * @param context - The network.
 * @param station - The station id.
 * @param time - When.
 * @returns Its display name then.
 */
const nameOn = (context: CaptionContext, station: string, time: number): string => context.index.stationName(station, time);

/**
 * The colour a line is drawn in once a step has happened: its own, or the line it is drawn as then.
 *
 * @param context - The network.
 * @param step - The step.
 * @param line - The line id.
 * @returns The line it is drawn as, and its colour.
 */
const drawnAs = (context: CaptionContext, step: Step, line: string): { id: string; color: string } => {
  const id = context.timeline.identityOf(line, step.index).id;
  return { id, color: context.colorOf(id) };
};

/**
 * A line opening, extended or reopening, from the first station it reaches to the last.
 *
 * @param step - The step.
 * @param context - The network.
 * @returns Its caption.
 */
const openCaption = (step: OpenStep, context: CaptionContext): Omit<StepInfo, 'time'> => {
  const { index, timeline } = context;
  const { reach } = planGrowth(step.segments, timeline.stationsOnMap(step.index), station => index.coordOf(station), index.centre);
  const existed = index.lineSegments.some(
    lineSegment => timeline.isOpen(lineSegment, step.index) && timeline.identityOf(lineSegment.line, step.index).id === step.line,
  );
  let verb = existed ? 'extended' : 'opens';
  if (step.lineSegments.every(lineSegment => lineSegment.previous !== null)) verb = 'reopens';
  const name = (station: string) => nameOn(context, station, step.time);
  return {
    kind: 'open',
    title: `${index.lineName(step.line)} ${verb}`,
    subtitle: `${name(required(reach[0], 'first station reached').station)} – ${name(required(reach.at(-1), 'last station reached').station)}`,
    color: context.colorOf(step.line),
    stations: reach.filter(reached => reached.isNew).map(reached => name(reached.station)),
  };
};

/**
 * A line's section suspended, or closing for good.
 *
 * @param step - The step.
 * @param context - The network.
 * @returns Its caption.
 */
const closeCaption = (step: CloseStep, context: CaptionContext): Omit<StepInfo, 'time'> => {
  const ends = step.lineSegments.flatMap(({ segment }) => [nameOn(context, segment.stationA, step.time), nameOn(context, segment.stationB, step.time)]);
  const returns = step.lineSegments.every(lineSegment => lineSegment.next !== null);
  return {
    kind: 'close',
    title: `${context.index.lineName(step.line)}: section ${returns ? 'suspended' : 'closes'}`,
    subtitle: [...new Set(ends)].join(' – '),
    color: context.colorOf(step.line),
    stations: [],
  };
};

/**
 * A station opening, or closing, on lines that run through it.
 *
 * @param step - The step.
 * @param context - The network.
 * @returns Its caption.
 */
const stationCaption = (step: InfillStep | StationCloseStep, context: CaptionContext): Omit<StepInfo, 'time'> => {
  const lines = step.lines.map(line => drawnAs(context, step, line));
  const name = nameOn(context, step.station, step.time);
  return {
    kind: step.kind,
    title: `${name} ${step.kind === 'infill' ? 'opens' : 'closes'}`,
    subtitle: `on the ${lines.map(line => context.index.lineName(line.id)).join(' and ')}`,
    color: required(lines[0], `line of a ${step.kind} step`).color,
    stations: step.kind === 'infill' ? [name] : [],
  };
};

/**
 * A station renamed: its name the day before, and now.
 *
 * @param step - The step.
 * @param context - The network.
 * @returns Its caption.
 */
const renameCaption = (step: RenameStep, context: CaptionContext): Omit<StepInfo, 'time'> => {
  const [first] = context.index.lineSegmentsAt(step.station);
  const now = nameOn(context, step.station, step.time);
  return {
    kind: 'rename',
    title: `${nameOn(context, step.station, step.time - DAY_MS)} renamed`,
    subtitle: `now ${now}`,
    color: first ? context.colorOf(first.line) : '#ffffff',
    stations: [now],
  };
};

/**
 * Lines drawn as their own, no longer as another.
 *
 * @param step - The step.
 * @param context - The network.
 * @returns Its caption.
 */
const identityCaption = (step: IdentityStep, context: CaptionContext): Omit<StepInfo, 'time'> => ({
  kind: 'identity',
  title: step.text,
  color: context.colorOf(required(step.lines[0], 'line of an identity step')),
  stations: [],
});

/**
 * A change in words, as its caption says it: what happened, where, on which date, in its line's colour.
 *
 * @param step - The change.
 * @param context - The network, and the theme's colours.
 * @returns Its caption; a planned change has no date.
 */
export const captionOf = (step: Step, context: CaptionContext): StepInfo => {
  const time = step.planned ? null : step.time;
  if (step.kind === 'open') return { time, ...openCaption(step, context) };
  if (step.kind === 'close') return { time, ...closeCaption(step, context) };
  if (step.kind === 'rename') return { time, ...renameCaption(step, context) };
  if (step.kind === 'identity') return { time, ...identityCaption(step, context) };
  return { time, ...stationCaption(step, context) };
};
