import { CanvasTexture, SRGBColorSpace } from "three";

// Local art constants: this lane does not own core/tunables.ts.
export const GLYPH_COUNT = 39;
export const ORIGIN_GLYPH = 38;
const CELL = 64;
type Point = readonly [number, number];
interface Figure { readonly strokes: readonly (readonly Point[])[]; readonly origin: boolean }

// Original star-figures on a four-column sky grid. Semicolons lift the pen.
// These are authored here, not traced gate symbols or an Ancient alphabet.
const FIGURES = [
  "MAFK;FCD", "BFIN;IH", "DGLK;GB", "AEJO;JH", "MIFC;FHK", "BNKJ;NE",
  "ABGK;GJO", "PLFB;LJI", "CGJN;JME", "DHKF;KNO", "MJEBC;JP", "AEGK;GOP",
  "BNOL;NJI", "DCFI;FKP", "MNGC;GHL", "AEJN;JLP", "BCKO;KFE", "DGFIM;FO",
  "ABFLO;LKN", "MIJK;JGD", "PLGBA;GF", "CGKO;KMN", "EFBH;FJN", "NJKHD;KE",
  "AEFCD;FNO", "MJFGL;JON", "BCGHL;GIM", "DHKJI;KON", "ABJN;JGH", "PLKFE;KBC",
  "MIEGH;GNO", "BFKLP;KJI", "DCGON;GFE", "AEJN;NOK", "BGLP;GIM", "DHFJN;JKO",
  "MNGHD;GBC", "EJKOP;JFB", "MNKJ;JFE;KHG",
] as const;

function figure(code: string, origin = false): Figure {
  return { origin, strokes: code.split(";").map((stroke) => [...stroke].map((letter): Point => {
    const n = letter.charCodeAt(0) - 65;
    return [10 + (n % 4) * 14 + (Math.floor(n / 4) % 2) * 2, 10 + Math.floor(n / 4) * 14];
  })) };
}
const GLYPHS = FIGURES.map((code, i) => figure(code, i % 7 === 0 || i === ORIGIN_GLYPH));

// An angular display face, using our own grid/strokes. English always accompanies it.
const LETTERS: Readonly<Record<string, string>> = {
  A: "MBCD;DH P;FK", B: "MABGKJ;GKPO M", C: "DCAM P", D: "MABHLPM", E: "DCAM P;E G",
  F: "MABCD;EG", G: "DCAMP LKG", H: "AM;DP;EH", I: "AD;BN;MP", J: "AD;CO NM",
  K: "AM;DEKP", L: "AMP", M: "MAFKDP", N: "MAPD", O: "BC HPO MEB", P: "MABHK E",
  Q: "BC HPO MEB;KP", R: "MABHKE;FP", S: "DC AFG LPM", T: "AD;BN", U: "AMOPD",
  V: "AN D", W: "AMJGPD", X: "AP;DM", Y: "AFD;FN", Z: "ADM P",
};
const SCRIPT = new Map(Object.entries(LETTERS).map(([letter, code]) => [letter, figure(code.replaceAll(" ", ""))]));

function paths(f: Figure): string {
  return f.strokes.map((s) => `<path d="${s.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")}"/>`).join("");
}
function ink(f: Figure, stars: boolean): string {
  const p = f.strokes[0]![0]!;
  return `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="bevel">${paths(f)}${f.origin ? `<circle cx="${p[0]}" cy="${p[1]}" r="4"/>` : ""}</g>` +
    (stars ? f.strokes.map((s) => s.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="currentColor"/>`).join("")).join("") : "");
}
export function glyphSvg(index: number): string {
  return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${ink(GLYPHS[index] ?? GLYPHS[ORIGIN_GLYPH]!, true)}</svg>`;
}
export function scriptSvg(text: string): string {
  const chars = [...text.toUpperCase()];
  return `<svg class="old-script" viewBox="0 0 ${Math.max(1, chars.length) * 48} 64" aria-hidden="true" focusable="false">${chars.map((c, i) => {
    const f = SCRIPT.get(c);
    return f ? `<g transform="translate(${i * 48} 0) scale(.8 1)">${ink(f, false)}</g>` : "";
  }).join("")}</svg>`;
}

function drawFigure(ctx: CanvasRenderingContext2D, f: Figure, stars: boolean): void {
  ctx.lineWidth = 2;
  ctx.lineJoin = "bevel";
  for (const stroke of f.strokes) {
    ctx.beginPath();
    stroke.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
    if (stars) for (const [x, y] of stroke) {
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (f.origin) {
    const [x, y] = f.strokes[0]![0]!;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke();
  }
}

/** Canvas equivalent of scriptSvg, for procedural title textures. */
export function scriptCanvas(text: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, text.length) * 48; canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = ctx.fillStyle = "#ffd9a8";
  [...text.toUpperCase()].forEach((c, i) => {
    const f = SCRIPT.get(c);
    if (f) { ctx.save(); ctx.translate(i * 48, 0); ctx.scale(.8, 1); drawFigure(ctx, f, false); ctx.restore(); }
  });
  return canvas;
}

let strip: CanvasTexture | undefined;
/** Shared 39-cell texture strip, allocated once; annular geometry supplies its UVs. */
export function glyphStrip(): CanvasTexture {
  if (strip) return strip;
  const canvas = document.createElement("canvas");
  canvas.width = CELL * GLYPH_COUNT; canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#182333"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  GLYPHS.forEach((f, i) => {
    ctx.save(); ctx.translate(i * CELL, 0);
    ctx.strokeStyle = ctx.fillStyle = "#cfe9ff"; drawFigure(ctx, f, true);
    ctx.strokeStyle = "#506075"; ctx.strokeRect(1, 2, CELL - 2, CELL - 4); ctx.restore();
  });
  strip = new CanvasTexture(canvas); strip.colorSpace = SRGBColorSpace;
  return strip;
}

const addresses = new Map<string, readonly number[]>();
/** Stable FNV-1a seed + partial shuffle: six distinct stars, then the local origin. */
export function systemAddress(id: string): readonly number[] {
  const cached = addresses.get(id);
  if (cached) return cached;
  let seed = 2166136261;
  for (const c of id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const pool = Array.from({ length: ORIGIN_GLYPH }, (_, i) => i);
  const address: number[] = [];
  for (let i = 0; i < 6; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const at = seed % pool.length;
    address.push(pool[at]!); pool.splice(at, 1);
  }
  address.push(ORIGIN_GLYPH);
  const result = Object.freeze(address);
  addresses.set(id, result);
  return result;
}

export function addressMarkup(address: readonly number[]): string {
  return address.map((glyph, i) => `<span class="glyph" data-glyph="${glyph}" style="--step:${i}" title="${i === 6 ? "Point of origin" : `Coordinate ${i + 1}`} · ${glyph + 1}">${glyphSvg(glyph)}<small>${i === 6 ? "ORIGIN" : String(i + 1).padStart(2, "0")}</small></span>`).join("");
}
