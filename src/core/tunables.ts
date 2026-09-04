/**
 * Every feel/number constant lives here and is bound to the lil-gui panel in
 * `ui/debug.ts` (toggle with backtick). Sim, camera and render code read from
 * `T` at use time so live edits take effect immediately. Units: m, s, rad.
 */
export const T = {
  flight: {
    minSpeed: 40,
    maxSpeed: 240,
    boostSpeed: 420,
    accel: 90,
    boostAccel: 260,
    /** throttle fraction per second while W/S is held */
    throttleRate: 0.9,
    pitchRate: 1.5,
    yawRate: 0.9,
    rollRate: 2.6,
    /** stick units per pixel of mouse travel */
    stickGain: 0.0025,
    /** self-centering rate of the virtual stick (1/s) */
    stickReturn: 5.0,
    /** target bank (as right-vector.y) per unit of yaw stick */
    bankIntoTurn: 0.9,
    /** how hard the soft horizon pulls the wings level (1/s) */
    autoLevel: 1.2,
  },
  camera: {
    distance: 12,
    height: 2.8,
    lookAhead: 90,
    stiffness: 40,
    damping: 10,
    swayYaw: 2.0,
    swayPitch: 1.0,
    fovBase: 62,
    fovSpeed: 12,
    upFollow: 6,
  },
  render: {
    exposure: 1.0,
    bloomStrength: 0.65,
    bloomRadius: 0.35,
    bloomThreshold: 0.35,
  },
  sky: {
    starDensity: 1.0,
    nebulaStrength: 1.0,
  },
  planet: {
    atmosphereStrength: 1.4,
    seaLevel: 0.05,
    iceLine: 0.78,
  },
} satisfies Record<string, Record<string, number>>;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const moveToward = (v: number, target: number, maxDelta: number) =>
  Math.abs(target - v) <= maxDelta ? target : v + Math.sign(target - v) * maxDelta;
