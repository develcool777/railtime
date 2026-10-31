# @railtime/core

Helpers about nothing in rail, each written once and used by every package that needs it: the bottom
of the stack, depending on nothing (`../../ARCHITECTURE.md`). A helper that a second package needs moves
here; it is never copied.

```text
src/
├── date.utils.ts         ISO dates and timestamps, DAY_MS, YEAR_MS, yearOf, endOfYear, decadeOf; date.types.ts, IsoDate
├── geometry.utils.ts     offsetKm, distanceKm, boundsOf, sliceAlong, Web Mercator; geometry.types.ts, LngLat and Bounds
├── number.utils.ts       clamp
├── collection.utils.ts   pushTo: a list per key
├── required.utils.ts     required: a lookup that fails loudly
└── priorityQueue.service.ts
```
