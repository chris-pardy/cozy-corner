/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.defs'

/** A single frame within an animation layer */
export interface AnimationFrame {
  $type?: 'at.cozy-corner.defs#animationFrame'
  /** Source X in sprite sheet */
  x: number
  /** Source Y in sprite sheet */
  y: number
  /** Source width in sprite sheet */
  width: number
  /** Source height in sprite sheet */
  height: number
}

const hashAnimationFrame = 'animationFrame'

export function isAnimationFrame<V>(v: V) {
  return is$typed(v, id, hashAnimationFrame)
}

export function validateAnimationFrame<V>(v: V) {
  return validate<AnimationFrame & V>(v, id, hashAnimationFrame)
}

/** A layer of sprite animations */
export interface AnimationLayer {
  $type?: 'at.cozy-corner.defs#animationLayer'
  /** Animation state identifier. For base avatars and wearables, use the well-known directional targets: walk-south, walk-north, walk-east, walk-west, sit-south, sit-north, sit-east, sit-west, hold-south, hold-north, hold-east, hold-west, push-south, push-north, push-east, push-west, pickup-south, pickup-north, pickup-east, pickup-west, and dance. Frame count and frame rate are defined per layer — authors choose their own animation detail level. For items, this is the variant name. */
  target:
    | 'idle-south'
    | 'idle-north'
    | 'idle-east'
    | 'idle-west'
    | 'walk-south'
    | 'walk-north'
    | 'walk-east'
    | 'walk-west'
    | 'sit-south'
    | 'sit-north'
    | 'sit-east'
    | 'sit-west'
    | 'hold-south'
    | 'hold-north'
    | 'hold-east'
    | 'hold-west'
    | 'push-south'
    | 'push-north'
    | 'push-east'
    | 'push-west'
    | 'pickup-south'
    | 'pickup-north'
    | 'pickup-east'
    | 'pickup-west'
    | 'dance'
    | (string & {})
  /** The display name of the layer */
  layerName?: string
  /** The frames of the animation */
  frames: AnimationFrame[]
  /** The frame rate in milliseconds per frame */
  frameRate: number
  /** Draw order relative to the entity. 0 = behind (default), 1 = in front. For furniture this allows parts like armrests to draw over the avatar. */
  zIndex: number
  /** Optional color channel name for tint customization. Layers sharing the same channel name are tinted together. When present, the user can customize the tint color for this channel. When omitted, the layer is not user-customizable. */
  colorChannel?: string
}

const hashAnimationLayer = 'animationLayer'

export function isAnimationLayer<V>(v: V) {
  return is$typed(v, id, hashAnimationLayer)
}

export function validateAnimationLayer<V>(v: V) {
  return validate<AnimationLayer & V>(v, id, hashAnimationLayer)
}

/** A tint for a color channel. All animation layers sharing the same colorChannel name are tinted together. */
export interface ChannelTint {
  $type?: 'at.cozy-corner.defs#channelTint'
  /** The color channel name. Must match a colorChannel value on one or more animation layers. */
  channel: string
  /** Hex color to tint the channel (e.g. '#cc4444'). Must be a '#' followed by 3 or 6 hex digits. */
  tint: string
}

const hashChannelTint = 'channelTint'

export function isChannelTint<V>(v: V) {
  return is$typed(v, id, hashChannelTint)
}

export function validateChannelTint<V>(v: V) {
  return validate<ChannelTint & V>(v, id, hashChannelTint)
}

/** A named attribute with a value from 0–200 representing –100 to +100 (shifted positive). Used on critters and items to express attraction/repulsion to tile-emitted signals. */
export interface MovementAttribute {
  $type?: 'at.cozy-corner.defs#movementAttribute'
  /** The attribute name. */
  attribute:
    | 'light'
    | 'heat'
    | 'food'
    | 'water'
    | 'comfort'
    | 'noise'
    | 'people'
    | (string & {})
  /** Attribute strength. 0 = –100 (strong repulsion/absence), 100 = neutral, 200 = +100 (strong attraction/presence). */
  value: number
}

const hashMovementAttribute = 'movementAttribute'

export function isMovementAttribute<V>(v: V) {
  return is$typed(v, id, hashMovementAttribute)
}

export function validateMovementAttribute<V>(v: V) {
  return validate<MovementAttribute & V>(v, id, hashMovementAttribute)
}

/** Declares a named, typed state property on an entity. Behaviors read these values via entityState at runtime. */
export interface StateProperty {
  $type?: 'at.cozy-corner.defs#stateProperty'
  /** Property name used as the state key. */
  name: string
  /** Value type. Controls editor widget and serialisation. */
  type:
    | 'string'
    | 'integer'
    | 'blob'
    | 'direction'
    | 'edges'
    | 'attribute'
    | (string & {})
  /** Default value (as a string). Omit for blob properties. */
  default?: string
  /** When true, this property can be overridden on placement (room item) or equip (avatar wearable). Defaults to false. */
  allowOverride: boolean
}

const hashStateProperty = 'stateProperty'

export function isStateProperty<V>(v: V) {
  return is$typed(v, id, hashStateProperty)
}

export function validateStateProperty<V>(v: V) {
  return validate<StateProperty & V>(v, id, hashStateProperty)
}

/** A concrete value for a declared state property. Provide either value (for non-blob types) or blob (for blob type). */
export interface StateValue {
  $type?: 'at.cozy-corner.defs#stateValue'
  /** Must match a stateProperty name on the entity. */
  name: string
  /** String-serialised value for non-blob properties. */
  value?: string
  /** Blob value for blob-typed properties. */
  blob?: BlobRef
}

const hashStateValue = 'stateValue'

export function isStateValue<V>(v: V) {
  return is$typed(v, id, hashStateValue)
}

export function validateStateValue<V>(v: V) {
  return validate<StateValue & V>(v, id, hashStateValue)
}

export interface Behavior {
  $type?: 'at.cozy-corner.defs#behavior'
  /** Name for the script. */
  name: string
  /** Inline Lua source code. Mutually exclusive with codeBlob. */
  code?: string
  /** Lua source code stored as a blob. Mutually exclusive with code. */
  codeBlob?: BlobRef
}

const hashBehavior = 'behavior'

export function isBehavior<V>(v: V) {
  return is$typed(v, id, hashBehavior)
}

export function validateBehavior<V>(v: V) {
  return validate<Behavior & V>(v, id, hashBehavior)
}
