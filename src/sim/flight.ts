import { Quaternion, Vector3 } from "three";
import { T, clamp, lerp, moveToward } from "@/core/tunables";
import type { Input } from "@/core/input";
import type { ShipStats } from "@/ships/registry";
import { handlingTurn, type Handling } from "@/sim/handling";
import { MOVES, findMove, type MoveDef } from "@/sim/moves";

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
/** Ship right is −X: right-handed frame, right = forward × up = Z × Y. */
const RIGHT = new Vector3(-1, 0, 0);
const _q = new Quaternion();
const _fwd = new Vector3();
const _right = new Vector3();
const _n = new Vector3();
const _lat = new Vector3();

/**
 * Kinematic arcade-sim flight with momentum. The nose (+Z) is steered by the
 * stick; the velocity `vel` is a real vector: its forward component chases the
 * target speed at `accel` (or coasts down at `coastDecel`), its lateral
 * component decays at `latDamp`, so a hard turn slides and a released boost
 * carries. Flight assist off (X) drops the damping to `latDampOff` and speed
 * changes only by thrust (Shift) and retro (Space). `speed`/`velDir` are
 * derived from `vel` every tick for consumers. Drift (classic Space) freezes
 * `vel`; collisions reflect it. Roll is
 * manual (A/D) plus bank-into-turn and a soft-horizon auto-level; a double-tap
 * on A/D fires a fast 360° barrel roll with a sideways hop. A move (sim/moves.ts) is a scripted
 * manoeuvre: while one runs the stick is dead, its steps drive pitch, yaw, roll, speed and a sideways
 * slide from the table, and the boost bar has already paid for it.
 *
 * Two control schemes share this model (`input.scheme`, see core/scheme.ts):
 * classic drives speed from a W/S throttle; arcade holds `cruiseSpeed`, W/S are
 * a hard pull-up / dive on top of the mouse, and Space is a brake.
 * Keeps the previous tick's pose so render can interpolate via `sample()`.
 */
export class Flight {
  /** Sandbox-only experiment; reset clears it before every sortie. */
  handling: Handling | null = null;
  readonly pos = new Vector3();
  readonly quat = new Quaternion();
  readonly prevPos = new Vector3();
  readonly prevQuat = new Quaternion();
  readonly velDir = new Vector3(0, 0, 1);
  readonly vel = new Vector3(0, 0, T.flight.minSpeed);
  speed = T.flight.minSpeed;
  /** normal impact speed of the last rock hit (m/s) and its surface normal; consumers read and clear the speed */
  lastImpact = 0;
  readonly lastImpactNormal = new Vector3(0, 1, 0);
  throttle = 0.5;
  boosting = false;
  /** 0..1, drains while boosting; boost cannot re-engage below `boostMinEngage` (Ethan: "not overpowered") */
  boostEnergy = 1;
  /** Space used to mean "drift" in classic; drift now lives on flight assist off (X). Kept for the HUD. */
  drifting = false;
  braking = false;
  /** strafe thruster velocity along the starboard axis (m/s) */
  strafeV = 0;
  /** remaining barrel-roll angle (signed, rad); 0 when not rolling */
  barrelLeft = 0;
  /** the move table this hull plays from (content by default; the designer's TRY IT swaps in its working copy) */
  moves: readonly MoveDef[] = MOVES;
  /** the move in progress and how far into it we are (s) */
  move: MoveDef | null = null;
  moveT = 0;
  moveFeedback = "";
  moveFeedbackT = 0;
  /** Powered move thrust, for the existing engine presentation. */
  moveThrust = false;
  private readonly moveFrame = new Quaternion();
  private readonly moveOffsetVel = new Vector3();
  /** set by TRY IT: starts on the next tick, whatever the bar holds */
  pendingMove: string | null = null;
  /** seconds since the last collision, for camera shake / HUD flash */
  sinceHit = 99;
  /** set by combat when the hull fails: controls go dead, the ship tumbles on its last velocity */
  dead = false;
  /** per-hull multipliers on the shared T.flight numbers (ships/registry.ts) */
  stats: ShipStats = { speed: 1, agility: 1, hull: 1, guns: 1, missiles: 6, size: 1 };

  /** Back to the launch state at the origin: the gate swap reuses one Flight across systems. */
  reset(): void {
    this.handling = null;
    this.pos.set(0, 0, 0);
    this.quat.identity();
    this.prevPos.set(0, 0, 0);
    this.prevQuat.identity();
    this.velDir.set(0, 0, 1);
    this.vel.set(0, 0, T.flight.minSpeed);
    this.speed = T.flight.minSpeed;
    this.lastImpact = 0;
    this.throttle = 0.5;
    this.boosting = false;
    this.boostEnergy = 1;
    this.drifting = this.braking = false;
    this.strafeV = 0;
    this.barrelLeft = 0;
    this.move = null;
    this.moveT = 0;
    this.moveFeedback = "";
    this.moveFeedbackT = 0;
    this.moveThrust = false;
    this.moveOffsetVel.set(0, 0, 0);
    this.pendingMove = null;
    this.sinceHit = 99;
    this.dead = false;
  }

  /** Start a move by id regardless of the bar (the designer's TRY IT, the sandbox); false when unknown. */
  startMove(id: string): boolean {
    const m = this.moves.find((x) => x.id === id);
    if (!m) return false;
    this.pendingMove = id;
    return true;
  }

  private beginMove(m: MoveDef, pay: boolean): void {
    if (pay) this.boostEnergy = clamp(this.boostEnergy - m.cost, 0, 1);
    this.move = m;
    this.moveFrame.copy(this.quat);
    this.moveT = 0;
    this.barrelLeft = 0;
  }

  /** top speed this hull can hold (boost) */
  get topSpeed(): number {
    return T.flight.boostSpeed * this.stats.speed;
  }

  turnGain(speedCoupled: boolean): number {
    const f = T.flight;
    return this.handling ? handlingTurn(this.handling, this.speed, this.stats.speed)
      : speedCoupled ? lerp(f.turnSlowGain, f.turnFastGain, clamp((this.speed - f.minSpeed) / (f.boostSpeed - f.minSpeed), 0, 1)) : 1;
  }

  tick(dt: number, input: Input): void {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    const f = T.flight;
    this.sinceHit += dt;
    this.moveFeedbackT = Math.max(0, this.moveFeedbackT - dt);
    if (!this.moveFeedbackT) this.moveFeedback = "";
    if (this.dead) {
      this.quat.multiply(_q.setFromAxisAngle(_n.set(0.6, 0.3, 1).normalize(), 2.2 * dt)).normalize();
      this.vel.multiplyScalar(Math.exp(-0.5 * dt));
      this.speed = this.vel.length();
      this.pos.addScaledVector(this.vel, dt);
      this.boosting = false;
      return;
    }

    this.vel.sub(this.moveOffsetVel);
    this.moveOffsetVel.set(0, 0, 0);
    this.moveThrust = false;
    const arcade = input.scheme.arcade;
    // moves: a chord from input pays the bar and starts one; TRY IT starts one for free; a running move
    // owns the stick, the roll keys and the throttle until its duration is up
    if (this.pendingMove !== null) {
      const m = this.moves.find((x) => x.id === this.pendingMove);
      this.pendingMove = null;
      if (m) this.beginMove(m, false);
    } else if (input.moveFired) {
      const m = findMove(this.moves, input.move.key, input.move.dir);
      if (m) {
        this.moveFeedbackT = 1.4;
        if (this.move) this.moveFeedback = `FINISH ${this.move.name.toUpperCase()} FIRST`;
        else if (this.boostEnergy < m.cost) this.moveFeedback = `NEED ${Math.ceil(m.cost * 100)}% BOOST · ${Math.floor(this.boostEnergy * 100)}% AVAILABLE`;
        else { this.beginMove(m, true); this.moveFeedback = `${m.name.toUpperCase()} · −${Math.round(m.cost * 100)}% BOOST`; }
      }
    }
    const mv = this.move;
    if (mv) {
      this.moveT = Math.min(mv.duration, this.moveT + dt);
      if (this.moveT >= mv.duration) this.move = null;
    }
    const stickX = mv ? 0 : input.stick.x, stickY = mv ? 0 : input.stick.y;
    const pitchKey = mv ? 0 : input.pitchKey, rollKey = mv ? 0 : input.roll;
    if (!arcade) this.throttle = clamp(this.throttle + pitchKey * f.throttleRate * dt, 0, 1);
    const canBoost = this.boostEnergy > 0 && (this.boosting || this.boostEnergy >= f.boostMinEngage);
    this.boosting = !mv && input.boost && canBoost;
    this.boostEnergy = clamp(this.boostEnergy + (this.boosting ? -f.boostDrain : mv ? 0 : f.boostRecharge) * dt, 0, 1);
    // Space brakes in both schemes (Ethan, 2026-09-05: "make space actually work to brake"); releasing it
    // returns to the throttle (classic) or cruise (arcade) speed
    this.drifting = false;
    this.braking = !mv && input.space && !this.boosting;
    const S = this.stats;
    let targetSpeed = arcade ? f.cruiseSpeed : lerp(f.minSpeed, f.maxSpeed, this.throttle);
    let rate = f.accel;
    if (this.braking) (targetSpeed = f.brakeSpeed), (rate = f.brakeDecel * (this.handling?.brake ?? 1));
    if (this.boosting) (targetSpeed = f.boostSpeed), (rate = f.boostAccel);
    targetSpeed *= S.speed;
    rate *= S.speed;
    let snap = arcade ? pitchKey * f.snapPitchRate * S.agility : 0;
    // the move's steps: each one active over [start, start + length) adds its rate or sets the speed target
    // Preserve earned over-boost momentum on exit; ordinary thrust cannot raise this cap.
    let moveYaw = 0, moveRoll = 0, moveHop = 0, moveSlide = 0, moveLift = 0, moveCoast = false, moveBrake = false, cap = Math.max(this.topSpeed, this.vel.length());
    if (mv) {
      const t = this.moveT;
      for (const s of mv.steps) {
        // Integrate partial steps exactly, including their first/last fixed tick.
        const weight = Math.max(0, Math.min(t, s.start + s.length) - Math.max(t - dt, s.start)) / dt;
        if (weight <= 0) continue;
        switch (s.kind) {
          case "brake":
            targetSpeed = s.amount * S.speed;
            rate = f.moveDecel * S.speed;
            moveBrake = true;
            break;
          case "boost":
            targetSpeed = s.amount * S.speed;
            rate = f.moveAccel * S.speed;
            cap = Math.max(cap, targetSpeed);
            this.moveThrust = true;
            break;
          case "snapPitch":
            snap += s.amount * weight;
            break;
          case "yaw":
            moveYaw += s.amount * weight;
            break;
          case "roll":
            moveRoll += s.amount * weight;
            break;
          case "hop":
            moveHop += s.amount * weight;
            break;
          case "slide": moveSlide += s.amount * weight; break;
          case "lift": moveLift += s.amount * weight; break;
          case "coast": moveCoast = s.amount > 0; break;
        }
      }
    }

    if (!mv && input.barrel !== 0 && this.barrelLeft === 0) this.barrelLeft = input.barrel * Math.PI * 2;

    _right.copy(RIGHT).applyQuaternion(this.quat);
    _fwd.copy(Z).applyQuaternion(this.quat);
    // Soft horizon: steer right.y toward the bank the turn asks for (right stick =
    // right wing down). Off near vertical (no horizon), while rolling by hand, and mid-barrel.
    const nearVertical = Math.abs(_fwd.y) > 0.95;
    const targetBank = clamp(-stickX * f.bankIntoTurn + input.strafe * f.strafeBank, -1, 1);
    const assistK = input.scheme.assistStrength;
    const levelRoll = nearVertical || rollKey !== 0 || this.barrelLeft !== 0 || mv ? 0 : (_right.y - targetBank) * f.autoLevel * assistK;

    // Rotations below are about local axes; signs follow from +X being port:
    //   +X rotation drops the nose, +Y rotation yaws the nose to port, +Z rotation rolls right.
    // speed-coupled turn rate (menu toggle): nimble at low speed, stiff at boost
    const turnK = this.turnGain(input.scheme.speedTurn);
    const pitch = -(stickY * f.pitchRate * S.agility * turnK + snap) * dt;
    const yaw = -(stickX * f.yawRate * S.agility * turnK + moveYaw) * dt;
    let roll = (rollKey * f.rollRate * S.agility * (this.handling?.roll ?? 1) + levelRoll + moveRoll) * dt;
    if (moveHop !== 0) this.moveOffsetVel.addScaledVector(_right, moveHop);
    if (moveSlide !== 0) this.moveOffsetVel.addScaledVector(_n.copy(RIGHT).applyQuaternion(this.moveFrame), moveSlide);
    if (moveLift !== 0) this.moveOffsetVel.addScaledVector(_n.copy(Y).applyQuaternion(this.moveFrame), moveLift);
    if (this.barrelLeft !== 0) {
      const step = clamp(this.barrelLeft, -f.barrelRate * dt, f.barrelRate * dt);
      this.barrelLeft -= step;
      if (Math.abs(this.barrelLeft) < 1e-4) this.barrelLeft = 0;
      roll += step;
      // sideways hop in the roll direction, strongest mid-roll
      this.pos.addScaledVector(_right, Math.sign(step) * f.barrelHop * Math.sin(Math.abs(this.barrelLeft) / 2) * dt);
    }
    this.quat.multiply(_q.setFromAxisAngle(X, pitch));
    this.quat.multiply(_q.setFromAxisAngle(Y, yaw));
    this.quat.multiply(_q.setFromAxisAngle(Z, roll));
    this.quat.normalize();

    _fwd.copy(Z).applyQuaternion(this.quat);
    if (!this.drifting && !moveCoast) {
      const assist = input.scheme.assist || mv !== null;
      // split velocity into along-nose and lateral parts
      let vf = this.vel.dot(_fwd);
      _lat.copy(this.vel).addScaledVector(_fwd, -vf);
      if (assist) {
        // coasting down (boost released, brake off) is slower than accelerating: momentum
        const decel = vf > targetSpeed && !this.braking && !moveBrake && !this.drifting ? f.coastDecel : rate;
        vf = moveToward(vf, targetSpeed, (vf > targetSpeed ? decel : rate) * dt);
        // a hard pull leaves the velocity behind for a moment, so the ship visibly slides through the turn
        _lat.multiplyScalar(Math.exp(-f.latDamp * assistK * (mv ? 1 : this.handling?.grip ?? 1) * (snap !== 0 ? f.snapSlide : 1) * dt));
      } else {
        // drift mode: the nose is free, velocity only changes by thrust
        if (input.boost && this.boostEnergy > 0) vf += f.thrust * 2 * dt;
        else if (input.space) vf = moveToward(vf, 0, f.thrust * dt), _lat.multiplyScalar(Math.exp(-f.thrust * 0.02 * dt));
        else if (!arcade) vf += pitchKey * f.thrust * dt;
        vf = clamp(vf, -f.maxSpeed * 0.5, this.topSpeed);
        _lat.multiplyScalar(Math.exp(-f.latDampOff * dt));
      }
      // strafe thrusters: the sideways velocity component is driven straight to the thruster speed
      // (+strafe = port = -RIGHT), and eased back to zero when released
      _right.copy(RIGHT).applyQuaternion(this.quat);
      const strafeTo = mv ? 0 : -input.strafe * f.strafeSpeed * S.agility;
      if (this.strafeV !== 0 || strafeTo !== 0) {
        this.strafeV = moveToward(this.strafeV, strafeTo, f.strafeAccel * dt);
        _lat.addScaledVector(_right, this.strafeV - _lat.dot(_right));
      }
      this.vel.copy(_fwd).multiplyScalar(vf).add(_lat);
      const total = this.vel.length();
      if (total > cap) this.vel.multiplyScalar(cap / total);
    }
    this.vel.add(this.moveOffsetVel);
    this.speed = this.vel.length();
    if (this.speed > 1e-3) this.velDir.copy(this.vel).divideScalar(this.speed);
    this.pos.addScaledVector(this.vel, dt);
  }

  /** Bounce off a surface with outward normal `n`: reflect velocity, bleed speed, nose follows. */
  bounce(n: Vector3): void {
    // The collision reflects the complete velocity, including powered translation.
    this.moveOffsetVel.set(0, 0, 0);
    _n.copy(n);
    const into = -this.vel.dot(_n); // normal impact speed, positive when moving into the face
    if (into >= this.lastImpact) this.lastImpactNormal.copy(_n);
    this.lastImpact = Math.max(this.lastImpact, into);
    if (into > 0) this.vel.addScaledVector(_n, 2 * into);
    const speed = this.vel.length();
    const keep = Math.max(T.flight.minSpeed * 0.6, speed * T.flight.bounceKeep);
    if (speed > 1e-3) this.vel.multiplyScalar(keep / speed);
    this.speed = keep;
    this.velDir.copy(this.vel).normalize();
    this.sinceHit = 0;
  }

  /** Damage fraction (0..1) for a rock impact at `into` m/s normal speed; 1 = certain death. */
  static impactDamage(into: number): number {
    const f = T.flight;
    const x = clamp((into - f.grazeSpeed) / (f.killSpeed - f.grazeSpeed), 0, 1);
    return x * x;
  }

  /** Interpolated pose for rendering. Render code must use this, never pos/quat. */
  sample(alpha: number, outPos: Vector3, outQuat: Quaternion): void {
    outPos.lerpVectors(this.prevPos, this.pos, alpha);
    outQuat.slerpQuaternions(this.prevQuat, this.quat, alpha);
  }
}
