import type { LineId, StationId } from '@railtime/schema/network.types';
import type { StopSteps } from './stops.types';

/**
 * When each line calls at each station on its track, where that is not simply while it runs there:
 * from the step the station opens on it (`infill`), to the one it stops calling at (`closed`), but
 * through its spells closed (`suspended`), or never (`passes`, or a station opened after it left). The
 * timeline sets it as it makes its steps, then asks it.
 */
export class StationStops {
  /** By station, then line. */
  private readonly stops = new Map<StationId, Map<LineId, StopSteps>>();

  /**
   * A line's stops at a station, made the first time one is set.
   *
   * @param station - The station id.
   * @param line - The line id.
   * @returns Its record, to set in place.
   */
  public stopOf(station: StationId, line: LineId): StopSteps {
    const byLine = this.stops.get(station) ?? new Map<LineId, StopSteps>();
    this.stops.set(station, byLine);
    const stop = byLine.get(line) ?? { opens: -1, closes: Infinity, never: false, spells: [] };
    byLine.set(line, stop);
    return stop;
  }

  /**
   * Whether a line calls at a station at a cursor: not before the station opens on it, nor after it
   * stops calling there, nor through a spell closed. While a closing step plays, the line still calls,
   * so it can fade; while an opening or a reopening plays, not yet, so it can appear.
   *
   * @param station - The station id.
   * @param line - The line id.
   * @param cursor - The cursor.
   * @returns True if the station is a stop on the line.
   */
  public serves(station: StationId, line: LineId, cursor: number): boolean {
    const stop = this.stops.get(station)?.get(line);
    if (!stop) return true;
    const inSpell = stop.spells.some(spell => spell.closes < cursor && cursor <= spell.reopens);
    return !stop.never && stop.opens < cursor && stop.closes >= cursor && !inSpell;
  }

  /**
   * Whether a line ever calls at a station.
   *
   * @param station - The station id.
   * @param line - The line id.
   * @returns False if it never does.
   */
  public ever(station: StationId, line: LineId): boolean {
    return !this.stops.get(station)?.get(line)?.never;
  }
}
