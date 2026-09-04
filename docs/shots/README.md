# Shots

Dated captures, `YYYY-MM-DD[b]-<view>.png` (a letter suffix for a second round on the same day), 1280×720, taken headless with the dev server running:

```sh
npm run dev                          # in another shell, port 5187
node scripts/capture-shots.mjs       # today's date; or pass YYYY-MM-DD [baseUrl]
```

First run only: `npx playwright install chromium`. The script writes six views: `side` (`?view=side&spin=0`, port side), `rear`, `top` (`dist=0.55`), `chase` (no params), `boost` (chase after holding Shift for 6 s: dust streaks, pull-back, long plumes; W is a pull-up in the arcade scheme, so it is not held) and `silhouette`. Compare against the previous date before committing. SwiftShader draws the pixels, so ignore the fps readout in these. Bulk video stays out of git (`*.mp4` ignored).
