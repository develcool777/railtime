import type { Network } from '@railtime/schema/network.types';
import { lineId, networkId, planId, stationId } from '@railtime/schema/testing/ids';
import { tinyNetwork } from './tinyNetwork.utils';

/**
 * The tiny network with a network beside it hidden at first, `rail`: its line `grey` shares C–D with the
 * metro from 1950 and runs on alone to X, which only it serves; it calls at C only from 1955; X changes
 * to A; and a plan, `grey-on`, takes `grey` on from X to a new station Y.
 *
 * @returns The network.
 */
export const hiddenNetwork = (): Network => {
  const network = tinyNetwork();
  network.networks[networkId('rail')] = { name: 'Rail', hidden: true };
  network.lines[lineId('grey')] = { name: 'Grey', network: networkId('rail'), mode: 'suburban-rail', color: '#888888', darkColor: '#bbbbbb' };
  network.stations[stationId('c')]!.infill![lineId('grey')] = '1955-01-01';
  network.stations[stationId('x')] = { name: 'X', coordinate: [0.0576, 51.5] };
  const shared = network.segments.find(segment => segment.stationA === 'c' && segment.stationB === 'd')!;
  shared.lines[lineId('grey')] = { open: '1950-01-01' };
  network.segments.push({
    stationA: stationId('d'),
    stationB: stationId('x'),
    coordinates: [
      [0.0432, 51.5],
      [0.0576, 51.5],
    ],
    lines: { [lineId('grey')]: { open: '1950-01-01' } },
  });
  network.transfers = [...(network.transfers ?? []), { stationA: stationId('a'), stationB: stationId('x') }];
  network.plans![planId('grey-on')] = {
    name: 'Grey on',
    status: 'proposed',
    stations: { [stationId('y')]: { name: 'Y', coordinate: [0.072, 51.5] } },
    sections: [{ line: lineId('grey'), stations: [stationId('x'), stationId('y')] }],
  };
  return network;
};
