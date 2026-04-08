/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'
import type * as AtCozyCornerDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.item'

export interface Main {
  $type: 'at.cozy-corner.item'
  /** Display name for the item. */
  name: string
  /** Free-form description of the item. */
  description?: string
  tags?: string[]
  spriteSheet: BlobRef
  /** layers of the item */
  layers: AtCozyCornerDefs.AnimationLayer[]
  /** Alternative visual appearances for this item. Each variant has a name and can set initial state values. */
  variants: Variant[]
  /** Lua scripts that define how this item responds to events. */
  behaviors?: AtCozyCornerDefs.Behavior[]
  /** Declares the configurable state properties for this item. Behaviors read these via entityState; variants and placements can override values. */
  stateProperties?: AtCozyCornerDefs.StateProperty[]
  createdAt: string
  [k: string]: unknown
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true)
}

export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
}

/** A named visual variant for an item. Sets spatial properties and can override state values. */
export interface Variant {
  $type?: 'at.cozy-corner.item#variant'
  /** The unique id of the variant (unique within the item) */
  id: string
  /** Display name for this variant. */
  name: string
  /** The default layer target of the layers to render for this variant. */
  target: string
  /** Width of the item in tiles. */
  itemWidth?: number
  /** Height of the item in tiles. */
  itemHeight?: number
  /** Per-tile edge blocking as a flat array of width * height (row-major). Each value is a bitmask: bits 0-3 = physical blocking per direction (N=1, E=2, S=4, W=8), bits 4-7 = ephemeral blocking per direction (N=16, E=32, S=64, W=128). Physical blocks movement; ephemeral blocks light/sound/heat. A fully blocked square has value 15 (physical) or 255 (both). 0 = no blocking. */
  blockedEdges?: number[]
  /** State values set by this variant, overriding stateProperty defaults. */
  state?: AtCozyCornerDefs.StateValue[]
}

const hashVariant = 'variant'

export function isVariant<V>(v: V) {
  return is$typed(v, id, hashVariant)
}

export function validateVariant<V>(v: V) {
  return validate<Variant & V>(v, id, hashVariant)
}
