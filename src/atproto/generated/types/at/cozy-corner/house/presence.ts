/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AtCozyCornerHouseDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.house.presence'

/** Authoritative state of an entity in the room, with fields for movement interpolation. */
export interface EntityState {
  $type?: 'at.cozy-corner.house.presence#entityState'
  id:
    | $Typed<AtCozyCornerHouseDefs.Did>
    | $Typed<AtCozyCornerHouseDefs.AnonymousId>
    | { $type: string }
  /** The user's handle. Empty string for anonymous users. */
  handle?: string
  /** Current tile x position. */
  x: number
  /** Current tile y position. */
  y: number
  /** Direction: 0=south, 1=west, 2=north, 3=east. */
  direction: number
  /** Animation state (idle, walk, sit). */
  animState: 'idle' | 'walk' | 'sit' | (string & {})
  /** Target tile x of current move step (if walking). */
  moveTargetX?: number
  /** Target tile y of current move step (if walking). */
  moveTargetY?: number
  /** Tick when the current move step started. */
  moveStartTick?: number
  /** Move speed in ms per tile. */
  moveSpeed?: number
  /** Current animation target (e.g. idle-south, walk-north). */
  target?: string
  /** Tick when the current animation target started. */
  targetStartTick?: number
  /** Text/emoji in the speech bubble. */
  speechText?: string
  /** Bubble style. */
  speechBubble?: 'thought' | 'speech'
  /** Tick when the speech bubble appeared. */
  speechStartTick?: number
  /** Duration in ms to show the speech bubble. */
  speechDuration?: number
}

const hashEntityState = 'entityState'

export function isEntityState<V>(v: V) {
  return is$typed(v, id, hashEntityState)
}

export function validateEntityState<V>(v: V) {
  return validate<EntityState & V>(v, id, hashEntityState)
}

/** Full authoritative state snapshot of all entities in the room. Sent each tick when state changes. */
export interface TickSnapshot {
  $type?: 'at.cozy-corner.house.presence#tickSnapshot'
  type: 'tickSnapshot'
  /** Server tick number for this snapshot. */
  tick: number
  /** All entities currently in this room instance. */
  entities: EntityState[]
}

const hashTickSnapshot = 'tickSnapshot'

export function isTickSnapshot<V>(v: V) {
  return is$typed(v, id, hashTickSnapshot)
}

export function validateTickSnapshot<V>(v: V) {
  return validate<TickSnapshot & V>(v, id, hashTickSnapshot)
}

/** A user left the room (immediate notification before next snapshot). */
export interface Leave {
  $type?: 'at.cozy-corner.house.presence#leave'
  type: 'leave'
  id:
    | $Typed<AtCozyCornerHouseDefs.Did>
    | $Typed<AtCozyCornerHouseDefs.AnonymousId>
    | { $type: string }
}

const hashLeave = 'leave'

export function isLeave<V>(v: V) {
  return is$typed(v, id, hashLeave)
}

export function validateLeave<V>(v: V) {
  return validate<Leave & V>(v, id, hashLeave)
}
