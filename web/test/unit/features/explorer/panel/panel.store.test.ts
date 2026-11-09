import { planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { openExplorer } from '@test/support/factories/explorer.utils';
import { timeAt } from '@test/support/factories/timeState.utils';
import { useNetworkStore } from '~/features/explorer/network.store';
import { usePanelStore } from '~/features/explorer/panel/panel.store';
import { useTimeStore } from '~/features/explorer/time/time.store';

describe('PanelStore', () => {
  test('says which lines had opened by the moment shown', () => {
    openExplorer();
    const panel = usePanelStore();
    const facts = useNetworkStore().facts!;
    useTimeStore().SET_TIME(timeAt(facts.playheads.on(Date.UTC(1935, 0, 1))));
    expect([...(panel.linesOpened ?? [])]).toEqual(['red', 'blue']);
  });

  test('shows the station open at the moment the map shows, with the way back to the line it was opened over', () => {
    openExplorer({ line: 'red', station: 'b' });
    useTimeStore().SET_TIME(timeAt({}));
    const panel = usePanelStore();
    expect(panel.station?.name).toBe('B');
    expect(panel.panelTop.title).toBe('B');
    expect(panel.panelTop.backLabel).toBe('Red');
  });

  test('lists the stations while the map plays, for the search, asking again at a change and not at every frame', () => {
    openExplorer();
    const panel = usePanelStore();
    useTimeStore().SET_TIME(timeAt({ cursor: 4, time: Date.UTC(1935, 0, 1), playing: true }));
    const stations = panel.stations;
    expect(stations.length).toBeGreaterThan(0);
    useTimeStore().SET_TIME(timeAt({ cursor: 4, time: Date.UTC(1936, 0, 1), playing: true }));
    expect(panel.stations).toBe(stations);
    useTimeStore().SET_TIME(timeAt({ cursor: 1, time: Date.UTC(1900, 0, 1), playing: true }));
    expect(panel.stations).not.toBe(stations);
    expect(panel.stations.map(entry => entry.id)).toEqual(['a', 'b']);
  });

  test("has a route's ends, a reach's start and their marks from the moment a link opens, before the map is ready", () => {
    openExplorer({ route: 'a,d', reach: 'b', at: '1920-01-01' });
    const panel = usePanelStore();
    expect(panel.routeStops).toEqual({ from: { id: stationId('a'), name: 'A' }, to: { id: stationId('d'), name: 'Old D' } });
    expect(panel.reachStop).toEqual({ id: stationId('b'), name: 'B' });
    expect(panel.marks).toMatchObject({ route: 'A route from A to Old D is set' });
    expect(panel.marks.reach).toContain('B');
  });

  test("names a route's ends and a reach's start on the date shown, as a renaming passes", () => {
    openExplorer({ route: 'a,d', reach: 'd' });
    const panel = usePanelStore();
    const facts = useNetworkStore().facts!;
    useTimeStore().SET_TIME(timeAt(facts.playheads.on(Date.UTC(1920, 0, 1))));
    expect(panel.routeStops.to).toEqual({ id: stationId('d'), name: 'Old D' });
    expect(panel.reachStop).toEqual({ id: stationId('d'), name: 'Old D' });
    useTimeStore().SET_TIME(timeAt(facts.playheads.on(Date.UTC(1930, 0, 1))));
    expect(panel.routeStops.to).toEqual({ id: stationId('d'), name: 'D' });
    expect(panel.marks.route).toBe('A route from A to D is set');
  });

  test('leaves out of the panel an end the network shown has not, and has it back with the network that does', () => {
    const explorer = openExplorer({ plan: 'extension', route: 'a,e' });
    const panel = usePanelStore();
    useTimeStore().SET_TIME(timeAt({}));
    expect(panel.routeStops.to?.id).toBe('e');
    explorer.SHOW_PLAN(undefined);
    expect(panel.routeStops).toEqual({ from: { id: stationId('a'), name: 'A' }, to: null });
    explorer.SHOW_PLAN(planId('extension'));
    expect(panel.routeStops.to?.id).toBe('e');
  });

  test("reads another network at its own moment from the action on, never the last one's cursor against it", () => {
    const explorer = openExplorer();
    const panel = usePanelStore();
    useTimeStore().SET_TIME(timeAt({ cursor: 2 }));
    explorer.SHOW_PLAN(planId('extension'));
    expect(panel.stations.map(stop => stop.id)).toContain(stationId('e'));
  });
});
