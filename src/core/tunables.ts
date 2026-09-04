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
    /** how fast the velocity vector chases the nose (1/s); lower = more inertia */
    velFollow: 9,
    /** speed bleed while drifting (m/s²) */
    driftDecel: 30,
    /** A/D double-tap window (ms) */
    doubleTapMs: 260,
    /** barrel roll rate (rad/s) and sideways hop (m/s at mid-roll) */
    barrelRate: 9.5,
    barrelHop: 28,
    /** fraction of speed kept after bouncing off a rock */
    bounceKeep: 0.45,
    /** arcade scheme: held speed, brake floor and how fast the brake bites */
    cruiseSpeed: 150,
    brakeSpeed: 45,
    brakeDecel: 160,
    /** arcade scheme: extra pitch rate while W/S is held (rad/s) and the velFollow multiplier during it */
    snapPitchRate: 2.4,
    snapSlide: 0.45,
    /** boost energy (0..1): drain per second while boosting, recharge per second otherwise, floor to re-engage */
    boostDrain: 0.32,
    boostRecharge: 0.18,
    boostMinEngage: 0.3,
  },
  camera: {
    distance: 16,
    height: 3.4,
    lookAhead: 90,
    stiffness: 40,
    damping: 10,
    swayYaw: 2.0,
    swayPitch: 1.0,
    fovBase: 62,
    fovSpeed: 14,
    upFollow: 6,
    /** extra pull-back on boost (m) */
    distanceBoost: 2.5,
    /** shake amplitude (m) right after a collision, and the constant boost rumble */
    hitShake: 0.7,
    boostShake: 0.05,
  },
  weapons: {
    /** player cannon: rounds per second (both guns together), muzzle speed and reach (m) */
    fireRate: 9,
    muzzleSpeed: 900,
    range: 1400,
    /** spread in radians per shot */
    spread: 0.006,
    damage: 12,
    /** tracer length = speed × this (s) */
    tracerSec: 0.014,
    enemyFireRate: 3,
    enemyMuzzleSpeed: 700,
    enemyDamage: 7,
    enemySpread: 0.02,
  },
  enemy: {
    hp: 40,
    cruise: 130,
    dash: 190,
    accel: 70,
    /** rad/s */
    turnRate: 1.3,
    /** roll gain into a turn (rad/s per unit of sideways want) */
    bank: 2.5,
    /** half-angle of the cone inside which it shoots (rad) */
    fireCone: 0.09,
    /** closer than this it peels off */
    breakDist: 110,
    /** clearance kept from rock surfaces */
    avoidDist: 90,
    radius: 5.5,
  },
  player: {
    hp: 100,
    /** hp regained per second after `regenDelay` seconds without a hit */
    regen: 4,
    regenDelay: 6,
  },
  arena: {
    /** play-field radius; beyond it a soft current turns you back */
    radius: 1500,
    turnRate: 1.4,
    shipRadius: 4.5,
  },
  fx: {
    dustCount: 700,
    dustBox: 220,
    /** streak length = velocity × this (s) */
    streakSec: 0.045,
    /** speed at which dust starts to show, and its max alpha */
    dustFrom: 70,
    dustAlpha: 0.55,
  },
  render: {
    exposure: 1.0,
    bloomStrength: 0.5,
    bloomRadius: 0.3,
    /** linear HDR luminance; diffuse toon shading stays under 1.0, emissives sit at 1.5+ */
    bloomThreshold: 1.0,
    vignette: 0.32,
    saturation: 1.08,
  },
  outline: {
    /** inverted-hull shell width on ships, in screen pixels */
    hullWidth: 1.8,
    /** sobel sample radius of the post edge pass, in pixels */
    edgeWidth: 1.0,
    /** relative view-depth discontinuity that counts as a silhouette */
    depthThreshold: 0.05,
    /** 1 - dot(n0, n1) that counts as a crease */
    normalThreshold: 0.45,
    /** crease lines fade out between these view distances (silhouettes never fade) */
    fadeNear: 500,
    fadeFar: 4000,
  },
  toon: {
    /** key light irradiance; lit albedo ≈ key / π */
    keyIntensity: 2.7,
    fillIntensity: 0.6,
    /** ramp value in shadow (0..1 of lit) */
    shadowStep: 0.36,
    /** ramp value in the half-lit band */
    midStep: 0.68,
  },
  plume: {
    /** metres at full throttle */
    length: 4.5,
    boostLength: 11,
    /** nozzle-radius multiplier of the flame base */
    width: 0.78,
    flicker: 0.18,
  },
  sky: {
    starDensity: 1.0,
    nebulaStrength: 1.0,
  },
  planet: {
    atmosphereStrength: 1.4,
    seaLevel: -0.04,
    /** |latitude| where ice caps start; ≥1 disables them (the reference frame has none) */
    iceLine: 1.05,
    /** width of the crisp limb line as a fraction of fresnel */
    rimWidth: 0.1,
  },
} satisfies Record<string, Record<string, number>>;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const moveToward = (v: number, target: number, maxDelta: number) =>
  Math.abs(target - v) <= maxDelta ? target : v + Math.sign(target - v) * maxDelta;
