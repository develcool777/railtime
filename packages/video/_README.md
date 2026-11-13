# @railtime/video

`pnpm video:record <city>`: a city's video page (`web`'s `/video/<city>`, under `pnpm dev` only)
recorded frame by frame into an MP4. What a video shows is `web`'s (`features/video/`); this package
only records a page.

```bash
pnpm dev                                         # the app, which the recorder opens
pnpm video:record kyiv                           # into packages/video/videos/
pnpm video:record kyiv --query "plan=<id>"       # a plan of the city's as its ending
pnpm video:record kyiv --page explorer --query "mapOnly=1" --seconds 60
pnpm video:record kyiv --query "view=2d"         # flat
```

Its arguments are read in `recorder.utils.ts` (`recordingOf`), its defaults in `recorder.constants.ts`.

## How it records (`recorder.service.ts`, `VideoRecorder`)

- **A clock only it moves.** The page runs on a clock the recorder installs: each frame it moves it on
  by one frame's time, waits for the page to say the frame is drawn, takes the picture, and hands it to
  ffmpeg. A slow frame makes the recording slower, never the video uneven.
- **A page by its handle alone.** It knows the page only by `VideoPageHandle` (`videoPage.types.ts`, the
  one thing `web` imports from here): it starts the page, says when it is over, and says when a frame
  is drawn: the map answering for the tiles in view, never for motion, which stands still with the clock.
- **A rehearsal first.** The page plays through once with no frame taken, so every tile the camera will
  look at is in Chrome's cache; the clock moves the same way both times, so the take finds them there.
  Chrome's profile is kept between recordings (`packages/video/.cache/`), so a city recorded again
  finds them already.

## Traps

- **The Chrome installed on this machine**, through `playwright-core`: no browser is downloaded.
- **ffmpeg installed** where Homebrew or the system puts it (`FFMPEG_LOCATIONS`): `brew install ffmpeg`.
- **The app served by `pnpm dev`**: the built site leaves the video pages out.
