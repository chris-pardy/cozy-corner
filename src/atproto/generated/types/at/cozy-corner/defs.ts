/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'
import type * as ComAtprotoRepoStrongRef from '../../com/atproto/repo/strongRef.js'

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
  transform?: Transform
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
  /** The state of the avatar or wearable, or the variant of the item. Values like 'idle', 'walk', 'sit'. */
  target: 'idle-north' | 'walk-south' | 'sit' | (string & {})
  /** The display name of the layer */
  layerName?: string
  /** The frames of the animation */
  frames: AnimationFrame[]
  /** The frame rate in milliseconds per frame */
  frameRate: number
}

const hashAnimationLayer = 'animationLayer'

export function isAnimationLayer<V>(v: V) {
  return is$typed(v, id, hashAnimationLayer)
}

export function validateAnimationLayer<V>(v: V) {
  return validate<AnimationLayer & V>(v, id, hashAnimationLayer)
}

/** A tint for a layer */
export interface LayerTint {
  $type?: 'at.cozy-corner.defs#layerTint'
  /** The indexes of the layers to tint */
  layerIndexes: number[]
  /** Hex color to tint the layer (e.g. '#cc4444'). Must be a '#' followed by 3 or 6 hex digits. If omitted, layer renders as-is. */
  tint: string
}

const hashLayerTint = 'layerTint'

export function isLayerTint<V>(v: V) {
  return is$typed(v, id, hashLayerTint)
}

export function validateLayerTint<V>(v: V) {
  return validate<LayerTint & V>(v, id, hashLayerTint)
}

/** 2D affine transform for wearables and other sprite-like entities. Components map directly to a CanvasRenderingContext2D-style transform(a, b, c, d, e, f). Values are stored as fixed-point integers where 1000 = 1.0 (e.g. 1500 = 1.5, -500 = -0.5). If omitted, the identity transform is used. */
export interface Transform {
  $type?: 'at.cozy-corner.defs#transform'
  /** Scale X / cos/skew component, fixed-point where 1000 = 1.0. Default 1000. */
  a: number
  /** Skew Y component, fixed-point where 1000 = 1.0. Default 0. */
  b: number
  /** Skew X component, fixed-point where 1000 = 1.0. Default 0. */
  c: number
  /** Scale Y component, fixed-point where 1000 = 1.0. Default 1000. */
  d: number
  /** Translate X in avatar or world coordinate units, fixed-point where 1000 = 1.0 unit. Default 0. */
  e: number
  /** Translate Y in avatar or world coordinate units, fixed-point where 1000 = 1.0 unit. Default 0. */
  f: number
}

const hashTransform = 'transform'

export function isTransform<V>(v: V) {
  return is$typed(v, id, hashTransform)
}

export function validateTransform<V>(v: V) {
  return validate<Transform & V>(v, id, hashTransform)
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

/** An entry in a category. */
export interface CategorizedEntry {
  $type?: 'at.cozy-corner.defs#categorizedEntry'
  item: ComAtprotoRepoStrongRef.Main
  /** The category of the entry. */
  category:
    | 'item'
    | 'wearable'
    | 'tileset'
    | 'baseAvatar'
    | 'critter'
    | (string & {})
}

const hashCategorizedEntry = 'categorizedEntry'

export function isCategorizedEntry<V>(v: V) {
  return is$typed(v, id, hashCategorizedEntry)
}

export function validateCategorizedEntry<V>(v: V) {
  return validate<CategorizedEntry & V>(v, id, hashCategorizedEntry)
}
