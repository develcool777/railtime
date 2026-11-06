import { entriesOf, keysOf, pushTo } from '@railtime/core/collection.utils';
import { toTimestamp } from '@railtime/core/date.utils';
import { required } from '@railtime/core/required.utils';
import type { LineId, StationId } from '@railtime/schema/network.types';
import { collectDays, markLinesAfterClosure } from './days.utils.ts';
import type { LineSegment, Step } from './engine.types';
import { Growths } from './growth.service.ts';
import type { NetworkIndex } from './index.service';
import { StationStops } from './stops.service.ts';
import type { AliasEnd, DayChanges, LineIdentity, StepDraft } from './timeline.types';
import { connectedStretches, forkedParts, linesByStation } from './timeline.utils.ts';

/**
 * The network's history as an ordered list of steps.
 *
 * A **cursor** is a position in that list: cursor `k` means steps `0..k-1` have happened. Explore
 * mode sits on a cursor; playback moves it one step at a time, animating `steps[cursor]`.
 *
 * On one date the order is: identity changes, then openings (line by line, one connected stretch
 * per step, a stretch that forks a step per branch), then stations opening on existing track, then
 * stations closing on it, then closures, then renames (the steps of `Timeline`'s constructor).
 *
 * A plan built on the network follows every dated step, undated, line by line: each line's new track
 * as one, whatever sections the plan gives it, so a line grows from an end, never from the middle
 * one way and back for the other; a step per connected stretch and branch, as a day's; then its
 * stations opening on existing track. Its steps are `planned`, at time `Infinity`.
 */
export class Timeline {
  /** Every step, in the order they play. */
  public readonly steps: Step[] = [];
  /** How many steps are dated: the planned ones follow them. */
  public readonly datedCount: number;
  /** How each opening grows and each closure retracts. */
  public readonly growths: Growths;
  /** The network this timeline describes. */
  private readonly index: NetworkIndex;
  /** The step at which each line segment opens. */
  private readonly openStep = new Map<LineSegment, number>();
  /** The step at which each line segment closes, if it does. */
  private readonly closeStep = new Map<LineSegment, number>();
  /** When each line calls at each station, where it does not simply call while it runs there. */
  private readonly stops = new StationStops();
  /** Per line, the steps at which it stops being drawn as each of its aliases, in order. */
  private readonly aliasEnds = new Map<LineId, AliasEnd[]>();

  public constructor(index: NetworkIndex) {
    this.index = index;
    const days = collectDays(index, this.stops);
    for (const [time, day] of [...days].toSorted(([first], [second]) => first - second)) {
      this.addIdentitySteps(time, day.identities);
      this.addOpenSteps(time, day.opens);
      this.addInfillSteps(time, day.infills);
      // A station closes on its line while the line runs there: before the day's track closes under it.
      this.addStationCloseSteps(time, day.stationCloses);
      this.addCloseSteps(time, day.closes);
      for (const rename of day.renames) this.addStep({ kind: 'rename', time, ...rename });
    }
    this.datedCount = this.steps.length;
    this.addPlannedSteps();
    this.indexAliasEnds();
    markLinesAfterClosure(index, this.stops);
    this.growths = new Growths(index, this);
  }

  /** Where the timeline starts, as a timestamp. */
  public get start(): number {
    return toTimestamp(this.index.network.meta.start);
  }

  /** The last dated step's date, or the start without one. */
  public get lastDate(): number {
    return this.steps[this.datedCount - 1]?.time ?? this.start;
  }

  /**
   * How many steps have happened by the end of a day: dated steps only, as planned ones have no day.
   *
   * @param time - A timestamp on that day.
   * @returns The cursor.
   */
  public cursorAt(time: number): number {
    let low = 0;
    let high = this.datedCount;
    while (low < high) {
      const middle = (low + high) >> 1;
      // Within bounds: low <= middle < high <= datedCount <= steps.length.
      if (this.steps[middle]!.time <= time) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  /**
   * Whether a line segment is on the map.
   *
   * @param lineSegment - The line segment.
   * @param cursor - The cursor.
   * @returns True once it has opened and while it has not closed.
   */
  public isOpen(lineSegment: LineSegment, cursor: number): boolean {
    return (this.openStep.get(lineSegment) ?? Infinity) < cursor && (this.closeStep.get(lineSegment) ?? Infinity) >= cursor;
  }

  /**
   * Whether a line segment has closed.
   *
   * @param lineSegment - The line segment.
   * @param cursor - The cursor.
   * @returns True once its closing step has played.
   */
  public hasClosed(lineSegment: LineSegment, cursor: number): boolean {
    return (this.closeStep.get(lineSegment) ?? Infinity) < cursor;
  }

  /**
   * Whether a line calls at a station on its track: not before the station opens on it (infill), nor
   * after it stops calling there, nor through a spell closed. While a closing step plays, the line
   * still calls, so it can fade; while a reopening plays, not yet, so it can appear.
   *
   * @param station - The station id.
   * @param line - The line id.
   * @param cursor - The cursor.
   * @returns True if the station is a stop on the line.
   */
  public servesStation(station: StationId, line: LineId, cursor: number): boolean {
    return this.stops.serves(station, line, cursor);
  }

  /**
   * Whether a line calls at a station now: it runs there, its track there open, and the station is a
   * stop on it. The one rule of a line calling: everything that asks it, asks here.
   *
   * @param lineSegment - The line on a segment ending at the station.
   * @param station - The station id.
   * @param cursor - The cursor.
   * @returns True if the line calls there, by that segment.
   */
  public callsAt(lineSegment: LineSegment, station: StationId, cursor: number): boolean {
    return this.isOpen(lineSegment, cursor) && this.servesStation(station, lineSegment.line, cursor);
  }

  /**
   * The lines calling at a station at a cursor, as the map draws them.
   *
   * @param station - The station id.
   * @param cursor - The cursor.
   * @returns Each line once, in side-by-side order.
   */
  public linesCallingAt(station: StationId, cursor: number): LineId[] {
    const calling = this.index.lineSegmentsAt(station).filter(lineSegment => this.callsAt(lineSegment, station, cursor));
    return [...new Set(calling.map(lineSegment => this.drawnAs(lineSegment.line, cursor)))].toSorted(this.index.compareLines);
  }

  /**
   * Whether a line ever called at a station on its track: not if the station opened after the line
   * had left (`infill` later than the line's last day there), nor where the line passes (`passes`).
   *
   * @param station - The station id.
   * @param line - The line id.
   * @returns True if the station was a stop on the line at some point.
   */
  public everServes(station: StationId, line: LineId): boolean {
    return this.stops.ever(station, line);
  }

  /**
   * What a line is drawn as. While the identity step at the cursor plays (`transitioning`), the line
   * already counts as its new self, with `previousId` set for the colour blend.
   *
   * @param line - The line id.
   * @param cursor - The cursor.
   * @param transitioning - The identity step at the cursor is playing.
   * @returns The line's identity.
   */
  public identityOf(line: LineId, cursor: number, transitioning = false): LineIdentity {
    const ends = this.aliasEnds.get(line) ?? [];
    for (const [position, end] of ends.entries()) {
      if (end.step > cursor || (end.step === cursor && !transitioning)) return { id: end.as };
      if (end.step === cursor) return { id: ends[position + 1]?.as ?? line, previousId: end.as };
    }
    return { id: line };
  }

  /**
   * The line the map draws a line as at a cursor (`LineAlias`): what every answer about that moment
   * calls it.
   *
   * @param line - The line id.
   * @param cursor - The cursor.
   * @returns Its own id, or the alias's.
   */
  public drawnAs(line: LineId, cursor: number): LineId {
    return this.identityOf(line, cursor).id;
  }

  /**
   * The lines the map draws as one line at a cursor: itself, and those drawn as it then.
   *
   * @param line - The id of the line as drawn.
   * @param cursor - The cursor.
   * @returns Their ids, in the network's order.
   */
  public linesDrawnAs(line: LineId, cursor: number): LineId[] {
    return keysOf(this.index.network.lines).filter(other => this.drawnAs(other, cursor) === line);
  }

  /**
   * The stations on the map at a cursor: the ones a new stretch grows out of.
   *
   * @param cursor - The cursor.
   * @param leaving - Line segments to leave out: a closure's own, for the network that stays.
   * @returns Their ids.
   */
  public stationsOnMap(cursor: number, leaving = new Set<LineSegment>()): Set<StationId> {
    return this.stationsOf(cursor, lineSegment => !leaving.has(lineSegment));
  }

  /**
   * The stations on the map on one line, as drawn on a date: an opening of it grows out of them first.
   *
   * @param line - The id of the line as drawn.
   * @param time - The date, which says what each line is drawn as.
   * @param cursor - The cursor.
   * @param leaving - Line segments to leave out: a closure's own.
   * @returns Their ids.
   */
  public stationsOnLine(line: LineId, time: number, cursor: number, leaving = new Set<LineSegment>()): Set<StationId> {
    return this.stationsOf(cursor, lineSegment => !leaving.has(lineSegment) && this.identityOn(lineSegment.line, time) === line);
  }

  /**
   * The ends of the line segments open at a cursor that a filter keeps.
   *
   * @param cursor - The cursor.
   * @param keeps - Whether a line segment counts.
   * @returns The stations' ids.
   */
  private stationsOf(cursor: number, keeps: (lineSegment: LineSegment) => boolean): Set<StationId> {
    const stations = new Set<StationId>();
    for (const lineSegment of this.index.lineSegments) {
      if (!keeps(lineSegment) || !this.isOpen(lineSegment, cursor)) continue;
      stations.add(lineSegment.segment.stationA);
      stations.add(lineSegment.segment.stationB);
    }
    return stations;
  }

  /**
   * What a line is drawn as on a date: used to group a day's openings, after that day's identity steps;
   * on the day it goes out as an alias ends (a gap), still that alias, as it goes.
   *
   * @param line - The line id.
   * @param time - The date's timestamp.
   * @returns The id of the line it is drawn as.
   */
  private identityOn(line: LineId, time: number): LineId {
    for (const alias of this.index.lineOf(line).aliases ?? []) {
      const until = toTimestamp(alias.until);
      if (time < until || (time === until && this.index.goesOutAt(line, time))) return alias.as;
    }
    return line;
  }

  /**
   * Appends a step, numbering it.
   *
   * @param draft - The step without its index.
   * @returns The step's index.
   */
  private addStep(draft: StepDraft): number {
    const index = this.steps.length;
    this.steps.push({ ...draft, index, planned: draft.time === Infinity });
    return index;
  }

  /**
   * Each plan line's steps, in the plan's order, its sections (which come together) as one: its new
   * track, grown as a day's openings grow; then its stations on existing track.
   */
  private addPlannedSteps(): void {
    const bySection = new Map<number, LineSegment[]>();
    for (const lineSegment of this.index.lineSegments) if (lineSegment.section !== null) pushTo(bySection, lineSegment.section, lineSegment);
    const lines: { line: LineId; positions: number[] }[] = [];
    for (const [position, section] of this.index.sections.entries()) {
      const last = lines.at(-1);
      if (last?.line === section.line) last.positions.push(position);
      else lines.push({ line: section.line, positions: [position] });
    }
    for (const { line, positions } of lines) {
      this.addOpenSteps(
        Infinity,
        positions.flatMap(position => bySection.get(position) ?? []),
      );
      this.addInfillSteps(
        Infinity,
        positions.flatMap(position =>
          required(this.index.sections[position], `section ${position}`).infills.map(station => ({ station, line, reopening: false })),
        ),
      );
    }
  }

  /**
   * One step per identity text: several lines splitting from one together is one step, not several.
   *
   * @param time - The date.
   * @param identities - That day's identity changes.
   */
  private addIdentitySteps(time: number, identities: DayChanges['identities']): void {
    const byText = new Map<string, LineId[]>();
    for (const { line, text } of identities) pushTo(byText, text, line);
    for (const [text, lines] of byText) this.addStep({ kind: 'identity', time, lines, text });
  }

  /**
   * One step per line and connected stretch, and per branch where it forks: each grows as one front.
   * Lines drawn as the same line (aliases) open together.
   *
   * @param time - The date.
   * @param opens - That day's openings.
   */
  private addOpenSteps(time: number, opens: LineSegment[]): void {
    const coordOf = (station: StationId) => this.index.coordOf(station);
    const byLine = new Map<LineId, LineSegment[]>();
    for (const lineSegment of opens) pushTo(byLine, this.identityOn(lineSegment.line, time), lineSegment);
    for (const [line, lineSegments] of [...byLine].toSorted(([first], [second]) => this.index.compareLines(first, second))) {
      for (const stretch of connectedStretches(lineSegments, coordOf, this.index.centre)) {
        const onMap = this.stationsOnMap(this.steps.length);
        for (const part of forkedParts(stretch, onMap, coordOf, this.index.centre, this.stationsOnLine(line, time, this.steps.length))) {
          const step = this.addStep({ kind: 'open', time, line, lineSegments: part, segments: [...new Set(part.map(item => item.segment))] });
          for (const lineSegment of part) this.openStep.set(lineSegment, step);
        }
      }
    }
  }

  /**
   * One step per line and connected stretch closing that day, and per branch where it forks: each
   * retracts as one front, as an opening grows, its branches back to the fork before the way they leave.
   *
   * @param time - The date.
   * @param closes - That day's closures.
   */
  private addCloseSteps(time: number, closes: LineSegment[]): void {
    const coordOf = (station: StationId) => this.index.coordOf(station);
    const byLine = new Map<LineId, LineSegment[]>();
    for (const lineSegment of closes) pushTo(byLine, this.identityOn(lineSegment.line, time), lineSegment);
    for (const [line, lineSegments] of byLine) {
      for (const stretch of connectedStretches(lineSegments, coordOf, this.index.centre)) {
        const closing = new Set(stretch);
        const staying = this.stationsOnMap(this.steps.length, closing);
        // Split as the stretch would open from the network that stays, played backwards: its last branch first.
        const stayingOnLine = this.stationsOnLine(line, time, this.steps.length, closing);
        for (const part of forkedParts(stretch, staying, coordOf, this.index.centre, stayingOnLine).toReversed()) {
          const step = this.addStep({ kind: 'close', time, line, lineSegments: part });
          for (const lineSegment of part) this.closeStep.set(lineSegment, step);
        }
      }
    }
  }

  /**
   * One step per station opening on existing track, covering all its lines: one for those it opens on
   * for the first time, one for those it reopens on after a spell closed.
   *
   * @param time - The date.
   * @param infills - That day's infill openings and reopenings.
   */
  private addInfillSteps(time: number, infills: DayChanges['infills']): void {
    for (const reopening of [false, true]) {
      for (const [station, lines] of linesByStation(infills.filter(infill => infill.reopening === reopening))) {
        const step = this.addStep({ kind: 'infill', time, station, lines, ...(reopening && { reopening: true as const }) });
        for (const line of lines) {
          const stop = this.stops.stopOf(station, line);
          // Reopening ends a spell: the last one closed, in date order.
          if (reopening) required(stop.spells.at(-1), `${station}'s spell closed on ${line}`).reopens = step;
          else stop.opens = step;
        }
      }
    }
  }

  /**
   * One step per station that lines stop calling at, covering all those lines: one for those it closes
   * on for good, one for those it closes on for a spell.
   *
   * @param time - The date.
   * @param closes - That day's station closures.
   */
  private addStationCloseSteps(time: number, closes: DayChanges['stationCloses']): void {
    for (const temporary of [false, true]) {
      for (const [station, lines] of linesByStation(closes.filter(close => close.temporary === temporary))) {
        const step = this.addStep({ kind: 'stationClose', time, station, lines, ...(temporary && { temporary: true as const }) });
        for (const line of lines) {
          const stop = this.stops.stopOf(station, line);
          if (temporary) stop.spells.push({ closes: step, reopens: Infinity });
          else stop.closes = step;
        }
      }
    }
  }

  /**
   * Finds, for each line with aliases, the identity step that ends each alias; for one ending as the
   * line goes out (a gap), the first step after that day's, the line drawn as its alias until it is out.
   */
  private indexAliasEnds(): void {
    for (const [line, info] of entriesOf(this.index.network.lines)) {
      const ends = (info.aliases ?? []).map(alias => {
        const time = toTimestamp(alias.until);
        if (!this.index.goesOutAt(line, time))
          return { as: alias.as, step: this.steps.findIndex(step => step.kind === 'identity' && step.time === time && step.lines.includes(line)) };
        const after = this.steps.findIndex(step => step.time > time);
        return { as: alias.as, step: after === -1 ? this.steps.length : after };
      });
      if (ends.length > 0) this.aliasEnds.set(line, ends);
    }
  }
}
