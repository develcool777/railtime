import { fakeMap } from '@railtime/renderer/testing/fakeMap';
import { TransitMap } from '@railtime/renderer/transitMap.service';
import type { TransitMapListeners, TransitMapOptions } from '@railtime/renderer/transitMap.types';

/** A command a stand-in map was given: its name and what it was given. */
export type MapCommand = { name: string; args: unknown[] };

/** What the stores call on the map: its commands, and `update`, where a store gives it props itself. */
const COMMANDS = ['update', 'seek', 'play', 'pause', 'stop', 'skip', 'previousChange', 'stepYear', 'zoomIn', 'zoomOut', 'fitNetwork'] as const;

/**
 * A stand-in for the map, as the stores use it: it owes one credit, and records each call it is given,
 * in order, doing nothing else.
 *
 * @returns The map, and the commands it has been given.
 */
export const standInMap = (): { map: TransitMap; commands: MapCommand[] } => {
  const commands: MapCommand[] = [];
  const record = Object.fromEntries(
    COMMANDS.map(name => [
      name,
      (...args: unknown[]) => {
        commands.push({ name, args });
      },
    ]),
  );
  return { map: { ...record, credits: [{ text: 'Tiles' }] } as unknown as TransitMap, commands };
};

/**
 * The renderer's own map on its stand-in for MapLibre, as a store drives it: its frames stepped by hand.
 *
 * @param props - What it is made with.
 * @param on - Its listeners.
 * @returns The map, a frame stepper, and what makes it ready: its style loaded, a frame run.
 */
export const mapOnStandIn = (props: TransitMapOptions['props'], on: TransitMapListeners): { map: TransitMap; frame: () => void; ready: () => void } => {
  const stand = fakeMap();
  const pending: ((now: number) => void)[] = [];
  const map = new TransitMap({
    container: {} as HTMLElement,
    props,
    on,
    createMap: () => stand.map,
    scheduler: {
      request: next => {
        pending.push(next);
        return pending.length;
      },
      cancel: () => (pending.length = 0),
    },
  });
  let now = 0;
  const frame = () => {
    now += 16;
    pending.shift()?.(now);
  };
  const ready = () => {
    stand.fire('style.load');
    frame();
  };
  return { map, frame, ready };
};
