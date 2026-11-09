import { describe, expect, test } from 'vitest';
import { checkPlans } from '../../../src/validation/plans.utils';
import { plannedNetwork } from '../../support/factories/plannedNetwork.utils';
import { asNetwork } from '../../support/ids.utils';
import type { WrittenNetwork } from '../../support/ids.utils';

/**
 * The problems the checks on each plan reports.
 *
 * @param network - A network, as its file is written.
 * @returns Each problem's message; none for a sound network.
 */
const problemsOf = (network: WrittenNetwork): string[] => {
  const problems: string[] = [];
  checkPlans(asNetwork(network), message => {
    problems.push(message);
  });
  return problems;
};

describe('PlansUtils', () => {
  test("refuses a plan's line the network already has", () => {
    const network = plannedNetwork();
    network.plans!.extension!.lines = { red: { name: 'Red again', network: 'metro', mode: 'metro', color: '#ff0000' } };
    expect(problemsOf(network)).toEqual(['plan extension: line red is already in the network']);
  });

  test("checks a plan's sections against the network and the plan", () => {
    const network = plannedNetwork();
    network.plans!.extension!.sections.push({ line: 'blue', stations: ['d', 'x'] });
    expect(problemsOf(network)).toEqual(['plan extension: section 2: unknown line blue', 'plan extension: section 2: unknown station x']);
  });

  test("refuses a plan's section of only stations between two laying its line's track, and takes one before them", () => {
    const network = plannedNetwork();
    const extension = network.plans!.extension!;
    extension.stations = { ...extension.stations, e: { name: 'E', coordinate: [0.0576, 51.5] } };
    extension.sections = [...extension.sections, { line: 'red', stations: ['d', 'e'] }];
    expect(problemsOf(network)).toEqual([]);
    extension.sections = [extension.sections[1]!, extension.sections[0]!, extension.sections[2]!];
    expect(problemsOf(network)).toEqual(["plan extension: section 1: only stations, between sections of red's track: its track goes unbroken"]);
  });

  test("refuses a plan coming back to a line after another line's sections: each line's go together, as they play", () => {
    const network = plannedNetwork();
    const extension = network.plans!.extension!;
    extension.lines = { ...extension.lines, green: { name: 'Green', network: 'metro', mode: 'metro', color: '#00aa00' } };
    extension.sections = [extension.sections[0]!, { line: 'green', stations: ['a', 'b'] }, ...extension.sections.slice(1)];
    expect(problemsOf(network)).toContain(`plan extension: section 2: ${extension.sections[2]!.line} again, after green: a line's sections go together`);
  });

  test("takes a plan's track between two stations a section links, and refuses one that would never be laid", () => {
    const network = plannedNetwork();
    const extension = network.plans!.extension!;
    // C to D, bowed a little north: a curve its trains take.
    extension.track = [
      {
        stationA: 'd',
        stationB: 'c',
        coordinates: [
          [0.03, 51.5],
          [0.025, 51.5003],
          [0.02, 51.5],
        ],
      },
    ];
    expect(problemsOf(network)).toEqual([]);
    extension.track.push(
      {
        stationA: 'c',
        stationB: 'd',
        coordinates: [
          [0.02, 51.5],
          [0.03, 51.5],
        ],
      },
      {
        stationA: 'a',
        stationB: 'd',
        coordinates: [
          [0, 51.5],
          [0.03, 51.5],
        ],
      },
      {
        stationA: 'a',
        stationB: 'c',
        coordinates: [
          [0, 51.5],
          [0.02, 51.5],
        ],
      },
      {
        stationA: 'c',
        stationB: 'x',
        coordinates: [
          [0.02, 51.5],
          [0.03, 51.5],
        ],
      },
    );
    expect(problemsOf(network)).toEqual([
      'plan extension: track c – d: given twice',
      'plan extension: track a – d: between stations no section links',
      'plan extension: track a – c: between stations no section links',
      'plan extension: track a – c: between stations the network links already',
      'plan extension: track c – x: unknown station x',
      'plan extension: track c – x: between stations no section links',
    ]);
  });

  test("holds a plan's track to a segment's: its ends on its stations, no turn sharper than its trains can", () => {
    const network = plannedNetwork();
    const extension = network.plans!.extension!;
    // Ending 70 m short of D, and doubling back at its middle.
    extension.track = [
      {
        stationA: 'c',
        stationB: 'd',
        coordinates: [
          [0.02, 51.5],
          [0.035, 51.5],
          [0.025, 51.5001],
          [0.029, 51.5],
        ],
      },
    ];
    expect(problemsOf(network)).toEqual([
      'plan extension: segment c – d: its track turns 179° at point 1, sharper than its trains can',
      'plan extension: segment c – d: its track ends 69 m from d',
    ]);
  });

  test('refuses a plan reusing an id the network has', () => {
    const network = plannedNetwork();
    network.plans!.extension!.stations!.a = { name: 'Another A', coordinate: [0, 51.6] };
    expect(problemsOf(network)).toEqual(['plan extension: station a is already in the network']);
  });

  test("refuses a plan whose network would be unsound: one of its lines in a network that isn't", () => {
    const network = plannedNetwork();
    network.plans!.extension!.lines = { green: { name: 'Green', network: 'tram', mode: 'tram', color: '#00aa00' } };
    expect(problemsOf(network)).toEqual(['plan extension: line green: unknown network tram']);
  });

  test("checks a plan's sections against the network alone when the plan has no stations of its own", () => {
    const network = plannedNetwork();
    delete network.plans!.extension!.stations;
    network.plans!.extension!.sections = [{ line: 'red', stations: ['a', 'x'] }];
    expect(problemsOf(network)).toEqual(['plan extension: section 0: unknown station x']);
  });
});
