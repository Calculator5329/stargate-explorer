import type { Wave } from "@/mission/levels";

/**
 * Prebuilt wave packs: named fights the designer drops into a wave list instead of typing a form. Each is a
 * short list of waves that reads as one idea (a swarm, a wall, a pair of aces). Numbers are the same units as
 * the wave editor: ships, seconds after the previous wave dies, spawn band in metres.
 */
export interface WavePack {
  id: string;
  name: string;
  blurb: string;
  waves: Wave[];
}

export const WAVE_PACKS: WavePack[] = [
  { id: "glider-swarm", name: "Glider swarm", blurb: "Numbers over quality: three growing waves of gliders. The opener for any system.", waves: [
    { count: 3, delay: 4, near: 700, far: 900 },
    { count: 4, delay: 5, near: 800, far: 1000 },
    { count: 6, delay: 6, near: 900, far: 1200 },
  ] },
  { id: "interceptor-sweep", name: "Interceptor sweep", blurb: "Fast and thin. Two waves that arrive close and break early; teaches leading the shot.", waves: [
    { count: 3, delay: 3, near: 500, far: 700, kinds: ["interceptor"] },
    { count: 5, delay: 4, near: 600, far: 800, kinds: ["interceptor", "interceptor", "glider"] },
  ] },
  { id: "gunboat-wall", name: "Gunboat wall", blurb: "Slow, armoured, hits hard. Two gunboats with a glider screen; missiles earn their keep.", waves: [
    { count: 4, delay: 5, near: 900, far: 1100, kinds: ["gunboat", "glider", "glider", "glider"] },
    { count: 5, delay: 8, near: 1000, far: 1300, kinds: ["gunboat", "gunboat", "glider", "glider", "interceptor"] },
  ] },
  { id: "ace-pair", name: "Ace pair", blurb: "Two aces, no screen. A duel that does not wait its turn.", waves: [
    { count: 2, delay: 4, near: 800, far: 1000, kinds: ["ace"] },
  ] },
  { id: "bomber-run", name: "Bomber run", blurb: "Bombers with an interceptor escort. Kill the escorts first or the bombers get their run in.", waves: [
    { count: 4, delay: 5, near: 1100, far: 1400, kinds: ["bomber", "interceptor", "bomber", "interceptor"] },
    { count: 5, delay: 8, near: 1200, far: 1500, kinds: ["bomber", "bomber", "interceptor", "interceptor", "glider"] },
  ] },
  { id: "mixed-pressure", name: "Mixed pressure", blurb: "Everything at once in rising order. The mid-campaign standard.", waves: [
    { count: 4, delay: 4, near: 700, far: 900, kinds: ["glider", "interceptor"] },
    { count: 5, delay: 6, near: 800, far: 1100, kinds: ["gunboat", "glider", "glider", "interceptor", "glider"] },
    { count: 6, delay: 7, near: 900, far: 1200, kinds: ["gunboat", "interceptor", "glider", "bomber", "glider", "interceptor"] },
  ] },
  { id: "finale", name: "Finale", blurb: "One big last wave with an ace in it. Put it after any of the others.", waves: [
    { count: 7, delay: 8, near: 900, far: 1300, kinds: ["ace", "gunboat", "glider", "interceptor", "glider", "glider", "interceptor"] },
  ] },
];
