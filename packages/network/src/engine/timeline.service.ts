import { toTimestamp } from '@railtime/core/date.utils';
import type { NetworkIndex } from './index.service';
import type { CloseStep, Growth, LineSegment, OpenStep, Step } from './engine.types';
import { pushTo } from '@railtime/core/collection.utils';
import { connectedStretches, forkedParts, planGrowth } from './timeline.utils.ts';
import type { AliasEnd, DayChanges, LineIdentity, StepDraft } from './timeline.types';

/**
 * The network's history as an ordered list of steps.
 *
 * A **cursor** is a position in that list: cursor `k` means steps `0..k-1` have happened. Explore
 * mode sits on a cursor; playback moves it one step at a time, animating `steps[cursor]`.
 *
 * On one date the order is: identity changes, then openings (line by line, one connected stretch
 * per step, a stretch that forks a step per branch), then closures, then stations opening on existing track, then stations closing on it,
 * then renames.
 *
 * A plan built on the network follows every dated step, undated: each section's openings, then its
 * stations opening on existing track. Its steps are `planned`, at time `Infinity`.
 */
export class Timeline {
  /** Every step, in the order they play. */
  public readonly steps: Step[] = [];
  /** How many steps are dated: the planned ones follow them. */
  public readonly datedCount: number;
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
  /** Lines that never called at a station on their track: it opened after they left, or closed before they came. Key `station|line`. */
  private readonly neverServed = new Set<string>();
  /** Per line, the steps at which it stops being drawn as each of its aliases, in order. */
  private readonly aliasEnds = new Map<string, AliasEnd[]>();
  /** Each opening's growth and each closure's retreat, worked out the first time it is asked for. */
  private readonly growths = new WeakMap<OpenStep | CloseStep, Growth>();

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
    this.datedCount = this.steps.length;
    this.addPlannedSteps();
    this.indexAliasEnds();
    this.markLinesAfterClosure();
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
   * How an opening grows: from the stations on the map before it (else the end nearest the centre),
   * segment by segment, and the order its stations come in. Its caption and its animation both read it.
   *
   * @param step - The opening.
   * @returns Its growth, worked out once.
   */
  public growthOf(step: OpenStep): Growth {
    const known = this.growths.get(step);
    if (known) return known;
    const planned = planGrowth(step.segments, this.stationsOnMap(step.index), station => this.index.coordOf(station), this.index.centre);
    const growth = this.calledAtOnly(planned, step.lineSegments, step.index + 1);
    this.growths.set(step, growth);
    return growth;
  }

  /**
   * How a closure retracts: its stretch planned as it would grow from the stations still on the map
   * after it (else the end nearest the centre), played backwards, so its front runs back to the
   * network that stays. A station `isNew` leaves the map with it, where its lines called.
   *
   * @param step - The closure.
   * @returns Its retreat as a growth, worked out once.
   */
  public retreatOf(step: CloseStep): Growth {
    const known = this.growths.get(step);
    if (known) return known;
    const segments = [...new Map(step.lineSegments.map(({ segment }) => [segment.index, segment])).values()];
    const planned = planGrowth(segments, this.stationsOnMap(step.index + 1), station => this.index.coordOf(station), this.index.centre);
    // While its closing step plays, a line still calls where it called.
    const growth = this.calledAtOnly(planned, step.lineSegments, step.index);
    this.growths.set(step, growth);
    return growth;
  }

  /**
   * A stretch's growth with only the stations its lines call at counted new: track running past a
   * station not yet open on them, or closed on them, is no stop.
   *
   * @param planned - The growth as planned on the track.
   * @param lineSegments - The stretch's line segments.
   * @param cursor - The cursor its lines' stops are asked at.
   * @returns The growth.
   */
  private calledAtOnly(planned: Growth, lineSegments: LineSegment[], cursor: number): Growth {
    const calledAt = (station: string) =>
      lineSegments.some(({ segment, line }) => (segment.stationA === station || segment.stationB === station) && this.servesStation(station, line, cursor));
    return { ...planned, reach: planned.reach.map(reached => ({ ...reached, isNew: reached.isNew && calledAt(reached.station) })) };
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
      // A plan's are undated: `addPlannedSteps` takes them, section by section.
      if (lineSegment.section !== null) continue;
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
        // A name changed while no line runs there is no event: the station opens, or comes back, under the later name.
        const onMap = this.index.lineSegmentsAt(station).some(lineSegment => lineSegment.opens < time && (lineSegment.closes ?? Infinity) > time);
        if (!onMap) continue;
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
    this.steps.push({ ...draft, index, planned: draft.time === Infinity } as Step);
    return index;
  }

  /** Each plan section's steps, in the plan's order: its openings, then its stations on existing track. */
  private addPlannedSteps(): void {
    const bySection = new Map<number, LineSegment[]>();
    for (const lineSegment of this.index.lineSegments) if (lineSegment.section !== null) pushTo(bySection, lineSegment.section, lineSegment);
    for (const [position, section] of this.index.sections.entries()) {
      this.addOpenSteps(Infinity, bySection.get(position) ?? []);
      this.addInfillSteps(
        Infinity,
        section.infills.map(station => ({ station, line: section.line })),
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
    const byText = new Map<string, string[]>();
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
    const coordOf = (station: string) => this.index.coordOf(station);
    const byLine = new Map<string, LineSegment[]>();
    for (const lineSegment of opens) pushTo(byLine, this.identityOn(lineSegment.line, time), lineSegment);
    for (const line of [...byLine.keys()].sort(this.index.compareLines)) {
      for (const stretch of connectedStretches(byLine.get(line)!, coordOf, this.index.centre)) {
        for (const part of forkedParts(stretch, this.stationsOnMap(this.steps.length), coordOf, this.index.centre)) {
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
    const coordOf = (station: string) => this.index.coordOf(station);
    const byLine = new Map<string, LineSegment[]>();
    for (const lineSegment of closes) pushTo(byLine, this.identityOn(lineSegment.line, time), lineSegment);
    for (const [line, lineSegments] of byLine) {
      for (const stretch of connectedStretches(lineSegments, coordOf, this.index.centre)) {
        const closing = new Set(stretch);
        const staying = new Set(
          this.index.lineSegments
            .filter(lineSegment => !closing.has(lineSegment) && this.isOpen(lineSegment, this.steps.length))
            .flatMap(({ segment }) => [segment.stationA, segment.stationB]),
        );
        // Split as the stretch would open from the network that stays, played backwards: its last branch first.
        for (const part of forkedParts(stretch, staying, coordOf, this.index.centre).reverse()) {
          const step = this.addStep({ kind: 'close', time, line, lineSegments: part });
          for (const lineSegment of part) this.closeStep.set(lineSegment, step);
        }
      }
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

  /** Marks the lines that first reached a station after it had closed on every line it served: they pass it by. */
  private markLinesAfterClosure(): void {
    for (const [station, info] of Object.entries(this.index.network.stations)) {
      const closed = info.closed ?? {};
      const closes = Object.values(closed).map(toTimestamp);
      if (closes.length === 0) continue;
      const lastClose = Math.max(...closes);
      const atStation = this.index.lineSegmentsAt(station);
      const before = new Set(atStation.filter(lineSegment => lineSegment.opens < lastClose).map(lineSegment => lineSegment.line));
      // A line that came earlier still calls there: the station never closed for good.
      if ([...before].some(line => !(line in closed))) continue;
      for (const { line } of atStation) if (!before.has(line)) this.neverServed.add(`${station}|${line}`);
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
