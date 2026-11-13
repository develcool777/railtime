# @railtime/schema

The format of a city's files, and the door every file comes in by. What a network, an outline and the
list of cities are (`format/`), the checks that hold a file to them (`validation/`), and a plan built on
a network (`plan/`). Pure: no map, no city named (`../../CLAUDE.md`).

```text
src/
  format/       the types: network.types.ts (Network, its stations, lines, segments and plans, the ids'
                brands), boundary.types.ts (CityBoundary), cities.types.ts (CityIndex: cities.json)
  validation/   the Zod shape (shape.schema.ts) and the checks between its parts, each a problem in words
                (checks.utils.ts: track ends on its stations, no turn sharper than its trains can;
                plans.utils.ts: a plan's sections in order, its track unbroken); the doors below
  plan/         PlanBuilder, buildPlan: a plan's sections laid on the network, built track split where
                a plan's station sits on it, new track curved through its stations (track.utils.ts)
```

## The doors

A file becomes a typed value in one place, never by `as` elsewhere (`house/served-files`, `house/checked-ids`):

```ts
import { parseNetwork } from '@railtime/schema/network.schema';
import { parseBoundary } from '@railtime/schema/boundary.schema';
import { servedNetwork, servedBoundary } from '@railtime/schema/served.utils';
import { isStationIn, isLineIn, isPlanIn } from '@railtime/schema/ids.utils';

parseNetwork(json); // checked whole: throws Zod's error with every problem listed (tests, commands)
servedNetwork(json); // trusted: the browser's door, for a file CI has already checked
isStationIn(network, 'bank'); // a string from an address becomes a StationId only here
```

Tests name their ids and write networks with `@railtime/schema/testing/ids` (`stationId('a')`,
`asNetwork({…})`), which trust what they are given: source never imports them (`house/test-helpers`).

## Where a rule goes

- A shape a single value must have (a date's format, a colour): the Zod shape, `shape.schema.ts`.
- A rule between parts (a segment's ends on its stations, a station's `infill` after its line opens):
  `checks.utils.ts` or `plans.utils.ts`, with its numbers in `checks.constants.ts`
  (`STATION_GAP_METRES`, `MIN_CURVE_RADIUS_METRES`).
- Each refused file is a test in `test/unit/validation/`, named for what it refuses.
