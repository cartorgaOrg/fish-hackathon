/**
 * Fishathon engine — everything in one import:
 *
 *   import { Game, Entity, Animator, FollowCamera, ... } from '@engine';
 *
 * Read docs/ENGINE.md for a guided tour of every primitive.
 */
export * as THREE from 'three';
export { Game } from './Game.js';
export { Entity } from './Entity.js';
export { Input } from './Input.js';
export { Assets, assetUrl, setShadows, getBounds, getSize, fitHeight, fitSize, centerOnGround, findNode, attach, setVisible, tint } from './Assets.js';
export { Animator } from './Animator.js';
export { Physics, Body, Collider, entityOf } from './Physics.js';
export { CharacterController } from './CharacterController.js';
export { FollowCamera } from './cameras/FollowCamera.js';
export { FirstPersonCamera } from './cameras/FirstPersonCamera.js';
export { RTSCamera } from './cameras/RTSCamera.js';
export { Health } from './Health.js';
export { StateMachine } from './StateMachine.js';
export { NavGrid, PathFollower } from './NavGrid.js';
export { Selection } from './Selection.js';
export { UI } from './UI.js';
export { Audio, BUILTIN_SOUNDS } from './Audio.js';
export { Effects } from './Effects.js';
export { setupEnvironment, gradientTexture, SKY_PRESETS } from './Environment.js';
export { box, sphere, cylinder, cone, capsule, plane } from './shapes.js';
export * from './utils.js';
