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
    /** relative steer: stick units per pixel of mouse travel */
    stickGain: 0.0025,
    /** cursor steer: cursor radius on screen (px), dead zone (fraction of it), response exponent (1 = linear), drift back to centre (1/s, 0 = stays put) */
    cursorRadius: 260,
    cursorDead: 0.05,
    cursorCurve: 1.35,
    cursorReturn: 0,
    /** self-centering rate of the virtual stick (1/s) */
    stickReturn: 5.0,
    /** target bank (as right-vector.y) per unit of yaw stick */
    bankIntoTurn: 0.9,
    /** how hard the soft horizon pulls the wings level (1/s) */
    autoLevel: 1.2,
    /** lateral velocity damping with flight assist on (1/s); lower = more slide through turns */
    latDamp: 3.2,
    /** same, assist off (X): near-Newtonian drift */
    latDampOff: 0.15,
    /** deceleration when coasting down from above the target speed (boost released), m/s² */
    coastDecel: 45,
    /** assist off: forward thrust from Shift and retro from Space, m/s² */
    thrust: 60,
    /** speed bleed while drifting (m/s²) */
    driftDecel: 30,
    /** strafe thrusters (Q/E): sideways speed (m/s), how fast it builds (m/s²), bank into the strafe (right.y per unit) */
    strafeSpeed: 70,
    strafeAccel: 160,
    strafeBank: 0.35,
    /** speed-coupled turn rate (menu toggle): pitch/yaw multiplier at min speed and at boost speed */
    turnSlowGain: 1.35,
    turnFastGain: 0.6,
    /** A/D double-tap window (ms) */
    doubleTapMs: 260,
    /** gamepad: stick dead zone and response curve exponent (1 = linear) */
    padDead: 0.14,
    padCurve: 1.5,
    /** barrel roll rate (rad/s) and sideways hop (m/s at mid-roll) */
    barrelRate: 9.5,
    barrelHop: 28,
    /** fraction of speed kept after bouncing off a rock */
    bounceKeep: 0.45,
    /** rock impact (normal speed, m/s): below `grazeSpeed` no damage, at `killSpeed` certain death */
    grazeSpeed: 35,
    killSpeed: 150,
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
    /** extra pull-back on boost (m) */
    distanceBoost: 2.5,
    /** shake amplitude (m) right after a collision, and the constant boost rumble */
    hitShake: 0.7,
    boostShake: 0.05,
    /** how fast the camera frame catches the ship's attitude (1/s): lower = the ship visibly rotates against the view in a pull-up or roll */
    followRate: 7,
    /** how fast the camera follows the nose (not the roll) while a barrel roll is running (1/s) */
    barrelFollow: 9,
    /** extra FOV (deg) and pull-back (m) during a barrel roll */
    barrelFov: 8,
    barrelDistance: 2.5,
  },
  weapons: {
    /** player cannon: rounds per second (both guns together), muzzle speed and reach (m) */
    fireRate: 13,
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
  missile: {
    /** rounds per sortie, restocked to this each wave */
    count: 6,
    speed: 520,
    accel: 300,
    /** homing turn rate (rad/s) */
    turnRate: 3.2,
    life: 7,
    damage: 60,
    /** proximity fuse radius on top of the target radius (m) */
    fuse: 4,
    /** seconds the target must sit inside the lock cone */
    lockTime: 0.9,
    /** half-angle of the lock cone (rad) and its reach (m) */
    lockCone: 0.12,
    lockRange: 1300,
    /** seconds between launches */
    cooldown: 0.8,
    /** seconds to rebuild one torpedo while the rack is not full (Ethan, 2026-09-05: "out of torpedos (maybe a slow slow reload)") */
    reload: 14,
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
    /** dogfight brain (2026-09-04): inside this range the geometry matters */
    saddleDist: 340,
    /** target's nose within this half-angle of the glider = head-on threat; go for the tail instead (rad) */
    noseCone: 0.9,
    /** the saddle aim point sits this far behind the target, and this far to the side */
    saddleBehind: 90,
    saddleSide: 45,
    /** give up on a saddle after this long and just pursue */
    saddleMax: 4.5,
    /** target's nose within this half-angle at closer than flinchDist makes the glider jink before the shot (rad) */
    flinchCone: 0.14,
    flinchDist: 280,
    flinchT: 0.7,
    flinchCd: 3.2,
    /** chance a look-down-the-throat actually triggers a flinch; the rest stay and get shot */
    flinchChance: 0.7,
    /** multipliers on T.weapons.enemyFireRate / enemyDamage / enemySpread for this kind */
    fireRate: 1,
    damage: 1,
    spread: 1,
    /** 1 = uses the saddle/flinch dogfight states, 0 = brawls straight in */
    dogfight: 1,
  },
  /** light enemy (combat/interceptor-def.ts): fast, fragile, twitchy, weak guns */
  interceptor: {
    // 2026-09-06 (Ethan: "the super fast enemy ships are a bit too hard"): slower, a little less twitchy, a
    // bigger hit sphere, and it flinches out of the sights less often. Still the fastest thing out there.
    hp: 20,
    cruise: 158,
    dash: 218,
    accel: 95,
    turnRate: 1.7,
    bank: 3.2,
    fireCone: 0.08,
    breakDist: 90,
    avoidDist: 70,
    radius: 5,
    saddleDist: 380,
    noseCone: 1.0,
    saddleBehind: 70,
    saddleSide: 40,
    saddleMax: 5,
    flinchCone: 0.16,
    flinchDist: 300,
    flinchT: 0.55,
    flinchCd: 2.6,
    flinchChance: 0.6,
    fireRate: 1.1,
    damage: 0.6,
    spread: 1.4,
    dogfight: 1,
  },
  /** heavy enemy (combat/gunboat-def.ts): slow, armoured, heavy guns, never flinches */
  gunboat: {
    // 2026-09-06 (Ethan: "the big fat ones are a little too easy"): more hull, turns a little better, a wider
    // gun cone and heavier rounds; it should take a run and a half of cannon, or a pair of missiles
    hp: 260,
    cruise: 88,
    dash: 120,
    accel: 38,
    turnRate: 0.7,
    bank: 0.9,
    fireCone: 0.18,
    breakDist: 170,
    avoidDist: 130,
    radius: 12,
    saddleDist: 0,
    noseCone: 0,
    saddleBehind: 0,
    saddleSide: 0,
    saddleMax: 0,
    flinchCone: 0,
    flinchDist: 0,
    flinchT: 0,
    flinchCd: 0,
    flinchChance: 0,
    fireRate: 0.9,
    damage: 3.0,
    spread: 0.8,
    dogfight: 0,
  },
  /** heavy bomber (combat/bomber-def.ts): slow, armoured, hits like a truck, never dogfights; goes for whatever it was assigned and keeps coming */
  bomber: {
    hp: 320,
    cruise: 95,
    dash: 125,
    accel: 30,
    turnRate: 0.45,
    bank: 0.7,
    fireCone: 0.16,
    breakDist: 200,
    avoidDist: 140,
    radius: 13,
    saddleDist: 0,
    noseCone: 0,
    saddleBehind: 0,
    saddleSide: 0,
    saddleMax: 0,
    flinchCone: 0,
    flinchDist: 0,
    flinchT: 0,
    flinchCd: 0,
    flinchChance: 0,
    fireRate: 0.5,
    damage: 3.6,
    spread: 1.4,
    dogfight: 0,
  },
  /** ace (glider hull, gold trim): a veteran glider pilot; faster, tougher, always dogfights, flinches almost every time */
  ace: {
    hp: 60,
    cruise: 150,
    dash: 215,
    accel: 90,
    turnRate: 1.7,
    bank: 3.0,
    fireCone: 0.08,
    breakDist: 100,
    avoidDist: 80,
    radius: 5.5,
    saddleDist: 420,
    noseCone: 1.1,
    saddleBehind: 80,
    saddleSide: 40,
    saddleMax: 6,
    flinchCone: 0.2,
    flinchDist: 360,
    flinchT: 0.6,
    flinchCd: 1.6,
    flinchChance: 0.95,
    fireRate: 1.3,
    damage: 1.2,
    spread: 0.6,
    dogfight: 1,
  },
  player: {
    hp: 100,
    /** hp regained per second after `regenDelay` seconds without a hit */
    regen: 4,
    regenDelay: 6,
  },
  rocks: {
    /** hull points per metre of bounding radius: a 5 m chip dies to two cannon rounds, a 40 m boulder wants a missile */
    hpPerMetre: 6,
    /** rocks smaller than this just vanish; bigger ones break into round(radius / fragPer) pieces, 2..6 */
    fragMin: 6,
    fragPer: 7,
    /** fragment radius as a fraction of the parent's, and how fast pieces leave (m/s) plus the push along the shot */
    fragScale: 0.38,
    fragSpeed: 55,
    fragPush: 40,
    /** seconds a fragment lives before it shrinks away */
    fragLife: 7,
    fragTumble: 2.5,
    /** a glider hitting a rock harder than this (m/s, relative to the rock) is destroyed; softer contact scrapes and bounces */
    crashKill: 8,
    /** mini-map radius in metres */
    mapRange: 900,
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
