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
const id = 'at.cozy-corner.starterPack'

export interface Main {
  $type: 'at.cozy-corner.starterPack'
  /** Display name for the starter pack. */
  name: string
  /** Free-form description of the starter pack. */
  description?: string
  /** Preview image for the starter pack. */
  splash?: BlobRef
  entries?: AtCozyCornerDefs.CategorizedEntry[]
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
