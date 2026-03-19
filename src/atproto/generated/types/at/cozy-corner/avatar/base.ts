/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AtCozyCornerDefs from '../defs.js'
import type * as AtCozyCornerScript from '../script.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.avatar.base'

export interface Main {
  $type: 'at.cozy-corner.avatar.base'
  /** Display name for the base avatar. */
  name: string
  /** Free-form description of the base avatar. */
  description?: string
  /** Tags for the base avatar. */
  tags?: string[]
  spriteSheet: BlobRef
  /** layers of the base avatar */
  layers: AtCozyCornerDefs.AnimationLayer[]
  /** Lua scripts that define how this avatar base responds to events (e.g. setting animation state based on movement, intercepting move events). */
  behaviors?: AtCozyCornerScript.Script[]
  /** Declares the configurable state properties for this base avatar. Behaviors read these via entityState. */
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
