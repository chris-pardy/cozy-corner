/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'
import type * as AtCozyCornerDefs from './defs.js'
import type * as AtCozyCornerScript from './script.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.critter'

export interface Main {
  $type: 'at.cozy-corner.critter'
  /** Display name for this critter type (e.g. Tabby Cat, Goldfish). */
  name: string
  /** Free-form description of the critter. */
  description?: string
  /** Tags for the critter. */
  tags?: string[]
  spriteSheet: BlobRef
  /** layers of the critter */
  layers: AtCozyCornerDefs.AnimationLayer[]
  /** Lua scripts that define how this critter responds to events (e.g. seeking tiles on a timer, reacting to nearby entities). */
  behaviors?: AtCozyCornerScript.Script[]
  /** Declares the configurable state properties for this critter. Behaviors read these via entityState; placements can override values. */
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
