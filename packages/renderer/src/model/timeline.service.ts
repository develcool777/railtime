import { toTimestamp } from './date.utils';
import type { NetworkIndex } from './networkIndex.service';
import type { LineSegment } from './networkIndex.types';
import type { AliasEnd, DayChanges, LineIdentity, Step, StepDraft } from './timeline.types';
import { connectedStretches, pushTo } from './timeline.utils';

/**
 * The network's history as an ordered list of steps.
 *
 * A **cursor** is a position in that list: cursor `k` means steps `0..k-1` have happened. Explore
 * mode sits on a cursor; playback moves it one step at a time, animating `steps[cursor]`.
 *
 * On one date the order is: identity changes, then openings (line by line, one connected stretch
 * per step), then closures, then stations opening on existing track, then stations closing on it,
 * then renames.
 */
export class Timeline {
  /** Every step, in the order they play. */
  public readonly steps: Step[] = [];
  /** The network this timeline describes. */
  private readonly index: NetworkIndex;
  /** The step at which each line segment opens. */
  private readonly openStep = new Map<LineSegment, number>();
  /** The step at which each line segment closes, if it does. */
  private readonly closeStep = new Map<LineSegment, number>();
  /** The step at which a station opens on a line it sits on: key `station|line`. */
  private readonly infillStep = new Map<string, number>();
  /** The step at which a line stops calling at a station it still runs through: key `station|line`. */
  private readonly stationCloseStep = new Map<string, number>();
  /** Stations that opened on a line's track after the line had left it for good: key `station|line`. */
  private readonly neverServed = new Set<string>();
  /** Per line, the steps at which it stops being drawn as each of its aliases, in order. */
  private readonly aliasEnds = new Map<string, AliasEnd[]>();

  public constructor(index: NetworkIndex) {
    this.index = index;
    const days = this.collectDays();
    for (const time of [...days.keys()].sort((first, second) => first - second)) {
      const day = days.get(time)!;
      this.addIdentitySteps(time, day.identities);
      this.addOpenSteps(time, day.opens);
      this.addCloseSteps(time, day.closes);
      this.addInfillSteps(time, day.infills);
      this.addStationCloseSteps(time, day.stationCloses);
      for (const rename of day.renames) this.addStep({ kind: 'rename', time, ...rename });
    }
    this.indexAliasEnds();
  }

  /** Where the timeline starts, as a timestamp. */
  public get start(): number {
    return toTimestamp(this.index.network.meta.start);
  }

  /**
   * How many steps have happened by the end of a day.
   *
   * @param time - A timestamp on that day.
   * @returns The cursor.
   */
  public cursorAt(time: number): number {
    let low = 0;
    let high = this.steps.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      // Within bounds: low <= middle < high <= steps.length.
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
   * Whether a line segment opens in the step at the cursor.
   *
   * @param lineSegment - The line segment.
   * @param cursor - The cursor.
   * @returns True if `steps[cursor]` opens it.
   */
  public opensAt(lineSegment: LineSegment, cursor: number): boolean {
    return this.openStep.get(lineSegment) === cursor;
  }

  /**
   * Whether a line segment closes in the step at the cursor.
   *
   * @param lineSegment - The line segment.
   * @param cursor - The cursor.
   * @returns True if `steps[cursor]` closes it.
   */
  public closesAt(lineSegment: LineSegment, cursor: number): boolean {
    return this.closeStep.get(lineSegment) === cursor;
  }

  /**
   * Whether a line calls at a station on its track: not before the station opens on it (infill), nor
   * after it stops calling there. While the closing step plays, the line still calls, so it can fade.
   *
   * @param station - The station id.
   * @param line - The line id.
   * @param cursor - The cursor.
   * @returns True if the station is a stop on the line.
   */
  public servesStation(station: string, line: string, cursor: number): boolean {
    const key = `${station}|${line}`;
    if (this.neverServed.has(key)) return false;
    return (this.infillStep.get(key) ?? -1) < cursor && (this.stationCloseStep.get(key) ?? Infinity) >= cursor;
  }

  /**
   * Whether a line ever called at a station on its track: not if the station opened after the line
   * had left (`infill` later than the line's last day there).
   *
   * @param station - The station id.
   * @param line - The line id.
   * @returns True if the station was a stop on the line at some point.
   */
  public everServes(station: string, line: string): boolean {
    return !this.neverServed.has(`${station}|${line}`);
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
  public identityOf(line: string, cursor: number, transitioning = false): LineIdentity {
    const ends = this.aliasEnds.get(line) ?? [];
    for (const [position, end] of ends.entries()) {
      if (end.step > cursor || (end.step === cursor && !transitioning)) return { id: end.as };
      if (end.step === cursor) return { id: ends[position + 1]?.as ?? line, previousId: end.as };
    }
    return { id: line };
  }

  /**
   * The stations on the map at a cursor: the ones a new stretch grows out of.
   *
   * @param cursor - The cursor.
   * @returns Their ids.
   */
  public stationsOnMap(cursor: number): Set<string> {
    const stations = new Set<string>();
    for (const lineSegment of this.index.lineSegments) {
      if (!this.isOpen(lineSegment, cursor)) continue;
      stations.add(lineSegment.segment.stationA);
      stations.add(lineSegment.segment.stationB);
    }
    return stations;
  }

  /**
   * Gathers every change in the network by its date.
   *
   * @returns The changes of each day, by timestamp.
   */
  private collectDays(): Map<number, DayChanges> {
    const days = new Map<number, DayChanges>();
    const day = (time: number) => {
      if (!days.has(time)) days.set(time, { opens: [], closes: [], infills: [], stationCloses: [], renames: [], identities: [] });
      return days.get(time)!;
    };
    for (const lineSegment of this.index.lineSegments) {
      day(lineSegment.opens).opens.push(lineSegment);
      if (lineSegment.closes) day(lineSegment.closes).closes.push(lineSegment);
    }
    for (const [station, info] of Object.entries(this.index.network.stations)) {
      for (const [line, date] of Object.entries(info.infill ?? {})) {
        const time = toTimestamp(date);
        // A station opening where its line had already gone for good is no event: the line passed by before it.
        const lineLater = this.index.lineSegmentsAt(station).some(lineSegment => lineSegment.line === line && (lineSegment.closes ?? Infinity) > time);
        if (lineLater) day(time).infills.push({ station, line });
        else this.neverServed.add(`${station}|${line}`);
      }
      for (const [line, date] of Object.entries(info.closed ?? {})) day(toTimestamp(date)).stationCloses.push({ station, line });
      for (const [position, former] of (info.formerNames ?? []).entries()) {
        const time = toTimestamp(former.until);
        // A name changed before the station opened is no event: it opens under the later name.
        if (!this.index.lineSegmentsAt(station).some(lineSegment => lineSegment.opens < time)) continue;
        day(time).renames.push({ station, from: former.name, to: info.formerNames?.[position + 1]?.name ?? info.name });
      }
    }
    for (const [line, info] of Object.entries(this.index.network.lines))
      for (const alias of info.aliases ?? []) day(toTimestamp(alias.until)).identities.push({ line, text: alias.text });
    return days;
  }

  /**
   * What a line is drawn as on a date: used to group a day's openings, after that day's identity steps.
   *
   * @param line - The line id.
   * @param time - The date's timestamp.
   * @returns The id of the line it is drawn as.
   */
  private identityOn(line: string, time: number): string {
    for (const alias of this.index.lineOf(line).aliases ?? []) if (time < toTimestamp(alias.until)) return alias.as;
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
    this.steps.push({ ...draft, index } as Step);
    return index;
  }

  /**
   * One step per identity text: several lines splitting from one together is one step, not several.
   *
   * @param time - The date.
   * @param identities - That day's identity changes.
   */
  private addIdentitySteps(time: number, identities: DayChanges['identities']): void {
    const byText = new Map<string, string[]>();
    for (const { line, text } of identities) pushTo(byText, text, line);
    for (const [text, lines] of byText) this.addStep({ kind: 'identity', time, lines, text });
  }

  /**
   * One step per line and connected stretch. Lines drawn as the same line (aliases) open together.
   *
   * @param time - The date.
   * @param opens - That day's openings.
   */
  private addOpenSteps(time: number, opens: LineSegment[]): void {
    const byLine = new Map<string, LineSegment[]>();
    for (const lineSegment of opens) pushTo(byLine, this.identityOn(lineSegment.line, time), lineSegment);
    for (const line of [...byLine.keys()].sort(this.index.compareLines)) {
      for (const stretch of connectedStretches(byLine.get(line)!, station => this.index.coordOf(station), this.index.centre)) {
        const step = this.addStep({ kind: 'open', time, line, lineSegments: stretch, segments: [...new Set(stretch.map(item => item.segment))] });
        for (const lineSegment of stretch) this.openStep.set(lineSegment, step);
      }
    }
  }

  /**
   * One step per line closing sections that day.
   *
   * @param time - The date.
   * @param closes - That day's closures.
   */
  private addCloseSteps(time: number, closes: LineSegment[]): void {
    const byLine = new Map<string, LineSegment[]>();
    for (const lineSegment of closes) pushTo(byLine, this.identityOn(lineSegment.line, time), lineSegment);
    for (const [line, lineSegments] of byLine) {
      const step = this.addStep({ kind: 'close', time, line, lineSegments });
      for (const lineSegment of lineSegments) this.closeStep.set(lineSegment, step);
    }
  }

  /**
   * One step per station opening on existing track, covering all its lines.
   *
   * @param time - The date.
   * @param infills - That day's infill openings.
   */
  private addInfillSteps(time: number, infills: DayChanges['infills']): void {
    const byStation = new Map<string, string[]>();
    for (const { station, line } of infills) pushTo(byStation, station, line);
    for (const [station, lines] of byStation) {
      const step = this.addStep({ kind: 'infill', time, station, lines });
      for (const line of lines) this.infillStep.set(`${station}|${line}`, step);
    }
  }

  /**
   * One step per station that lines stop calling at, covering all those lines.
   *
   * @param time - The date.
   * @param closes - That day's station closures.
   */
  private addStationCloseSteps(time: number, closes: DayChanges['stationCloses']): void {
    const byStation = new Map<string, string[]>();
    for (const { station, line } of closes) pushTo(byStation, station, line);
    for (const [station, lines] of byStation) {
      const step = this.addStep({ kind: 'stationClose', time, station, lines });
      for (const line of lines) this.stationCloseStep.set(`${station}|${line}`, step);
    }
  }

  /** Finds, for each line with aliases, the identity step that ends each alias. */
  private indexAliasEnds(): void {
    for (const [line, info] of Object.entries(this.index.network.lines)) {
      const ends = (info.aliases ?? []).map(alias => ({
        as: alias.as,
        step: this.steps.findIndex(step => step.kind === 'identity' && step.time === toTimestamp(alias.until) && step.lines.includes(line)),
      }));
      if (ends.length > 0) this.aliasEnds.set(line, ends);
    }
  }
}
