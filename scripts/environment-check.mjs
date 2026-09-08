// Pure Node geometry/collision checks: no renderer or browser required.
// Usage: node scripts/environment-check.mjs
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/world/asteroids.ts"], bundle: true, format: "esm", platform: "node", write: false });
const { Asteroids } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

for (const style of ["rock", "ice", "wreck"]) {
  const belt = new Asteroids({ count: 48, style, seed: 4040, inner: 80, outer: 1000, thickness: 200, shapes: 4 });
  let vertices = 0;
  for (let shape = 0; shape < 4; shape++) {
    const geometry = belt.group.children[shape * 3].geometry;
    const position = geometry.getAttribute("position");
    vertices += position.count;
    assert(Array.from(position.array).every(Number.isFinite), `${style}: finite vertices`);
    if (style !== "rock") {
      const color = geometry.getAttribute("color");
      assert(color && color.count === position.count, `${style}: one color per vertex`);
      assert(Array.from(color.array).every(Number.isFinite), `${style}: finite colors`);
    }
    if (style === "ice") {
      const planes = belt.planes[shape];
      for (let vertex = 0; vertex < position.count; vertex++) {
        for (let plane = 0; plane < planes.length; plane += 4) {
          const outside = position.getX(vertex) * planes[plane]
            + position.getY(vertex) * planes[plane + 1]
            + position.getZ(vertex) * planes[plane + 2] - planes[plane + 3];
          assert(outside <= 0.00001, `ice: visible vertex ${vertex} outside collision plane ${plane / 4} by ${outside}`);
        }
      }
    }
  }
  const target = Array.from(belt.radii).findIndex((radius) => radius > 15);
  assert(target >= 0, `${style}: breakable landmark exists`);
  belt.damage(target, 1e6);
  belt.tick(1 / 60);
  assert.equal(belt.alive[target], 0, `${style}: destroyed object retires`);
  assert.equal(belt.broken, 1, `${style}: destruction counted once`);
  assert(Array.from(belt.ttl).some((ttl) => ttl > 0), `${style}: destruction spawns fragments`);
  console.log(JSON.stringify({ style, vertices, geometry: "pass", destruction: "pass", ...(style === "ice" ? { convexCollision: "pass" } : {}) }));
}
