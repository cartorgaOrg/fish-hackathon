import * as THREE from 'three';
import { Body } from './Physics.js';
import { Animator } from './Animator.js';
import { Entity } from './Entity.js';
import { dampAngle, damp } from './utils.js';

/**
 * A ready-to-play third-person character: WASD to run (relative to the camera), Space to jump,
 * Shift to sprint, with animations wired up. Used by the RPG and platformer samples.
 *
 *   const model = await assets.model('/assets/kaykit-adventurers/Knight.glb');
 *   const player = game.add(new CharacterController(game, model, { camera: followCam }));
 *   player.locked = true;   // freeze controls (e.g. while attacking or in a dialog)
 *
 * It is an Entity, so you can tag it, find it, and subclass it. Animation names are lists so
 * the same code works for KayKit (Running_A) and Quaternius (CharacterArmature|Run) rigs.
 */
export class CharacterController extends Entity {
  /**
   * @param {import('./Game.js').Game} game
   * @param {THREE.Object3D} model  from assets.model(); its origin should be at the feet
   * @param {object} [opts]
   * @param {{ toWorld(v:{x:number,y:number}): THREE.Vector3 }} [opts.camera]  FollowCamera/FirstPersonCamera for camera-relative movement
   * @param {number} [opts.speed=6]
   * @param {number} [opts.sprintMultiplier=1.6]
   * @param {number} [opts.jumpSpeed=11]   initial upward velocity (0 = can't jump)
   * @param {number} [opts.maxJumps=1]     2 = double jump
   * @param {number} [opts.acceleration=14] how quickly you reach full speed (lower = icier)
   * @param {number} [opts.airControl=0.6]
   * @param {number} [opts.radius=0.4]
   * @param {number} [opts.height=1.8]
   * @param {Record<string, string|string[]>} [opts.animations]  override clip names: idle, walk, run, jump, fall, land
   */
  constructor(game, model, opts = {}) {
    super(new THREE.Group(), { tags: ['player'], name: 'player' });
    this.object.add(model);
    this.model = model;
    this.game = game;
    const { animations, position, radius = 0.4, height = 1.8, ...settings } = opts;
    Object.assign(this, {
      camera: null, speed: 6, sprintMultiplier: 1.6, jumpSpeed: 11, maxJumps: 1,
      acceleration: 14, airControl: 0.6, coyoteTime: 0.12, jumpBuffer: 0.12,
    }, settings);
    this.anims = {
      idle: ['Idle', 'Idle_Loop'],
      walk: ['Walking_A', 'Walk'],
      run: ['Running_A', 'Run', 'Jog_Fwd'],
      jump: ['Jump_Start', 'Jump'],
      fall: ['Jump_Idle', 'Jump_Loop', 'Jump'],
      ...animations,
    };
    this.body = new Body(game.physics, { radius, height, position });
    this.animator = new Animator(model);
    this.animator.play(this.anims.idle);
    /** set true to ignore input (cutscenes, attacks, dialogs) */
    this.locked = false;
    this._sinceGround = 0;
    this._sinceJumpPress = Infinity;
    this._jumps = 0;
    this._wasGround = true;
    this.object.position.copy(this.body.position);
  }

  /** Teleport (e.g. respawn at a checkpoint). */
  teleport(pos) {
    this.body.position.copy(pos);
    this.body.velocity.set(0, 0, 0);
    this.object.position.copy(pos);
  }

  /** Throw the character upward (springs, stomps, knockback). Not affected by the short-hop cut. */
  launch(vy, horizontal) {
    this.body.velocity.y = vy;
    if (horizontal) { this.body.velocity.x = horizontal.x; this.body.velocity.z = horizontal.z; }
    this._jumpCut = false;
    this._sinceGround = Infinity;
  }

  /** Face a world position immediately. */
  lookAt(pos) { this.object.rotation.y = Math.atan2(pos.x - this.position.x, pos.z - this.position.z); }

  update(dt) {
    const { input } = this.game;
    const body = this.body;

    // --- desired horizontal velocity
    let wish = new THREE.Vector3();
    if (!this.locked) {
      const m = input.move();
      wish = this.camera ? this.camera.toWorld(m) : new THREE.Vector3(m.x, 0, -m.y);
      const sprint = input.anyDown('ShiftLeft', 'ShiftRight') ? this.sprintMultiplier : 1;
      wish.multiplyScalar(this.speed * sprint);
    }
    const accel = this.acceleration * (body.onGround ? 1 : this.airControl);
    body.velocity.x = damp(body.velocity.x, wish.x, accel, dt);
    body.velocity.z = damp(body.velocity.z, wish.z, accel, dt);

    // --- jumping with coyote time + input buffering (feels much better than "only on ground")
    this._sinceGround = body.onGround ? 0 : this._sinceGround + dt;
    this._sinceJumpPress = !this.locked && (input.pressed('Space') || input.padPressed(0)) ? 0 : this._sinceJumpPress + dt;
    if (body.onGround) this._jumps = 0;
    if (this.jumpSpeed > 0 && this._sinceJumpPress <= this.jumpBuffer) {
      const groundJump = this._sinceGround <= this.coyoteTime;
      const airJump = !groundJump && Math.max(this._jumps, 1) < this.maxJumps;
      if (groundJump || airJump) {
        body.velocity.y = this.jumpSpeed;
        this._jumpCut = true;
        this._jumps = groundJump ? 1 : Math.max(this._jumps, 1) + 1;
        this._sinceJumpPress = Infinity;
        this._sinceGround = Infinity;
        this.animator.once(this.anims.jump, { fade: 0.05 });
        this.game.audio.play('jump');
        this.onJump?.();
      }
    }
    // variable jump height: release Space early for a short hop (only for our own jumps,
    // not for springs/knockback launched with launch())
    if (body.velocity.y <= 0) this._jumpCut = false;
    if (this._jumpCut && !input.down('Space') && !input.padDown(0) && body.velocity.y > 0) body.velocity.y *= Math.exp(-10 * dt);

    body.move(dt);
    this.object.position.copy(body.position);

    // --- face movement direction
    const flat = Math.hypot(body.velocity.x, body.velocity.z);
    if (flat > 0.5 && !this.locked) {
      this.object.rotation.y = dampAngle(this.object.rotation.y, Math.atan2(body.velocity.x, body.velocity.z), 14, dt);
    }

    // --- animation
    if (!this.animator.busy || (body.onGround && !this._wasGround)) {
      if (!body.onGround) this.animator.play(this.anims.fall, { fade: 0.15 });
      else if (flat > this.speed * 1.2) this.animator.play(this.anims.run, { speed: 1.2 });
      else if (flat > this.speed * 0.4) this.animator.play(this.anims.run);
      else if (flat > 0.3) this.animator.play(this.anims.walk);
      else this.animator.play(this.anims.idle);
    }
    this._wasGround = body.onGround;
    this.animator.update(dt);
  }
}
