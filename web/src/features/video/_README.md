# Video

A city's history as a video, to record (`pnpm video:record <city>`). The feature's top holds the frame
and the script; `insights/` is the panels round the map.

| Where                        | What                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `video.utils.ts`             | The rules: the script (`videoScriptOf`, each beat's scene, plan and framing), what shows when        |
| `video.store.ts`             | The state: walks the script, one beat at a time; `layers`, `insights` and `mapProps` follow the beat |
| `video.composable.ts`        | The effect: makes the map, gives the store each frame's clock, tells a recorder where it is          |
| `components/`                | The frame, and what shows over the map: title, year, caption, the plan's name, the end card          |
| `insights/insights.utils.ts` | The panels' numbers, asked of the network, and how each panel comes in                               |
| `insights/components/`       | The panels; their charts are the app's own (`components/ui/`), the explorer's too                    |

A new moment in a video is a beat in `videoScriptOf` and, if it needs one, a `VideoScene`.
