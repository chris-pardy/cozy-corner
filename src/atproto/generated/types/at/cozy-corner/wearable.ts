/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'
import type * as AtCozyCornerDefs from './defs.js'
import type * as ComAtprotoRepoStrongRef from '../../com/atproto/repo/strongRef.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.wearable'

export interface Main {
  $type: 'at.cozy-corner.wearable'
  /** Display name for the wearable. */
  name: string
  /** Free-form description of the wearable. */
  description?: string
  /** Tags for the wearable. */
  tags?: string[]
  spriteSheet: BlobRef
  /** layers of the wearable */
  layers: AtCozyCornerDefs.AnimationLayer[]
  /** Lua scripts that define how this wearable responds to events (e.g. setting animation state based on movement, intercepting move events). */
  behaviors?: AtCozyCornerDefs.Behavior[]
  /** Declares the configurable state properties for this wearable. Behaviors read these via entityState. */
  stateProperties?: AtCozyCornerDefs.StateProperty[]
  baseAvatar: ComAtprotoRepoStrongRef.Main
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
