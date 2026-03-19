/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.script'

export interface Script {
  $type?: 'at.cozy-corner.script#script'
  /** Display name for the script. */
  name?: string
  /** Inline Lua source code. Mutually exclusive with codeBlob. */
  code?: string
  /** Lua source code stored as a blob. Mutually exclusive with code. */
  codeBlob?: BlobRef
}

const hashScript = 'script'

export function isScript<V>(v: V) {
  return is$typed(v, id, hashScript)
}

export function validateScript<V>(v: V) {
  return validate<Script & V>(v, id, hashScript)
}
