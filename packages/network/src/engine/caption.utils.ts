import { DAY_MS } from '@railtime/core/date.utils';
import { required } from '@railtime/core/required.utils';
import type { LineId, StationId } from '@railtime/schema/network.types';
import type { CaptionContext } from './caption.types';
import type { CloseStep, IdentityStep, InfillStep, OpenStep, RenameStep, Step, StationCloseStep } from './engine.types';
import type { LineColor, StepInfo } from '../facts/facts.types';

/**
 * A station's name on a step's date.
 *
 * @param context - The network.
 * @param station - The station id.
 * @param time - When.
 * @returns Its display name then.
 */
const nameOn = (context: CaptionContext, station: StationId, time: number): string => context.index.stationName(station, time);

/**
 * The colour a line is drawn in once a step has happened: its own, or the line it is drawn as then.
 *
 * @param context - The network.
 * @param step - The step.
 * @param line - The line id.
 * @returns The line it is drawn as, and its colour.
 */
const drawnAs = (context: CaptionContext, step: Step, line: LineId): { id: LineId; color: LineColor } => {
  const id = context.timeline.drawnAs(line, step.index);
  return { id, color: context.index.colorOf(id) };
};

/**
 * An end of a stretch as a passenger knew it: the station itself where the line calls there, else the
 * nearest one along the line's track that it calls at (an extension leaving the line at a junction is
 * named from the station before it, one ending at a junction by the station after it); else the
 * station itself.
 *
 * @param context - The network.
 * @param station - The stretch's end.
 * @param line - The id of the line, as drawn.
 * @param cursor - The cursor the line is asked at.
 * @returns The station id.
 */
const stopNear = (context: CaptionContext, station: StationId, line: LineId, cursor: number): StationId => {
  const { index, timeline } = context;
  const onLine = (stop: StationId) =>
    index.lineSegmentsAt(stop).filter(lineSegment => timeline.isOpen(lineSegment, cursor) && timeline.drawnAs(lineSegment.line, cursor) === line);
  const seen = new Set([station]);
  // Read from its head, never shifted: a shift copies what is left each time.
  const queue = [station];
  let head = 0;
  while (head < queue.length) {
    // Within bounds: the loop's.
    const here = queue[head]!;
    head++;
    const lineSegments = onLine(here);
    if (lineSegments.some(lineSegment => timeline.servesStation(here, lineSegment.line, cursor))) return here;
    for (const { segment } of lineSegments) {
      const next = segment.stationA === here ? segment.stationB : segment.stationA;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return station;
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
  const { reach } = timeline.growths.growthOf(step);
  const existed = index.lineSegments.some(
    lineSegment => timeline.isOpen(lineSegment, step.index) && timeline.drawnAs(lineSegment.line, step.index) === step.line,
  );
  let verb = existed ? 'extended' : 'opens';
  if (step.lineSegments.every(lineSegment => lineSegment.previous !== null)) verb = 'reopens';
  const name = (station: StationId) => nameOn(context, station, step.time);
  return {
    kind: 'open',
    title: `${index.lineName(step.line)} ${verb}`,
    // Where it starts, on the line before it; where it ends, on the line it makes.
    subtitle: `${name(stopNear(context, required(reach[0], 'first station reached').station, step.line, step.index))} – ${name(stopNear(context, required(reach.at(-1), 'last station reached').station, step.line, step.index + 1))}`,
    color: index.colorOf(step.line),
    stations: reach.filter(reached => reached.isNew).map(reached => name(reached.station)),
  };
};

/**
 * A line's section suspended, or closing for good, from the network that stays to the far end: as
 * an opening, by its ends, never by track it ran past without calling.
 *
 * @param step - The step.
 * @param context - The network.
 * @returns Its caption.
 */
const closeCaption = (step: CloseStep, context: CaptionContext): Omit<StepInfo, 'time'> => {
  const { reach } = context.timeline.growths.retreatOf(step);
  const name = (station: StationId) => nameOn(context, station, step.time);
  const returns = step.lineSegments.every(lineSegment => lineSegment.next !== null);
  return {
    kind: 'close',
    title: `${context.index.lineName(step.line)}: section ${returns ? 'suspended' : 'closes'}`,
    // Where it starts, on the line that stays; where it ends, on the line before it closes.
    subtitle: `${name(stopNear(context, required(reach[0], 'first station left').station, step.line, step.index + 1))} – ${name(stopNear(context, required(reach.at(-1), 'last station left').station, step.line, step.index))}`,
    color: context.index.colorOf(step.line),
    stations: [],
  };
};

/**
 * What a station does on its lines, as a caption says it.
 *
 * @param step - A station's opening or closing.
 * @returns "opens", "reopens", "closes", "closes temporarily".
 */
const stationVerb = (step: InfillStep | StationCloseStep): string => {
  if (step.kind === 'infill') return step.reopening ? 'reopens' : 'opens';
  return step.temporary ? 'closes temporarily' : 'closes';
};

/**
 * A station opening, or closing, on lines that run through it: for good, or for a while.
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
    title: `${name} ${stationVerb(step)}`,
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
    color: first ? context.index.colorOf(first.line) : { light: '#ffffff', dark: '#ffffff' },
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
  color: context.index.colorOf(required(step.lines[0], 'line of an identity step')),
  stations: [],
});

/**
 * A change in words, as its caption says it: what happened, where, on which date, in its line's colour.
 *
 * @param step - The change.
 * @param context - The network.
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
