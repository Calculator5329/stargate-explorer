# Shots

Dated captures, `YYYY-MM-DD-<view>.png`, 1280×720, taken headless with the dev server running:

```sh
npm run dev                          # in another shell, port 5187
node scripts/capture-shots.mjs       # today's date; or pass YYYY-MM-DD [baseUrl]
```

First run only: `npx playwright install chromium`. The script writes five views: `side` (`?view=side&spin=0`), `rear`, `top` (`dist=0.55`), `chase` (no params) and `silhouette`. Compare against the previous date before committing. SwiftShader draws the pixels, so ignore the fps readout in these. Bulk video stays out of git (`*.mp4` ignored).
