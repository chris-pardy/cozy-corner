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

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.house.defs'

export interface Did {
  $type?: 'at.cozy-corner.house.defs#did'
  type: 'did'
  /** DID of the user. */
  did: string
}

const hashDid = 'did'

export function isDid<V>(v: V) {
  return is$typed(v, id, hashDid)
}

export function validateDid<V>(v: V) {
  return validate<Did & V>(v, id, hashDid)
}

export interface AnonymousId {
  $type?: 'at.cozy-corner.house.defs#anonymousId'
  type: 'anonymousId'
  /** Anonymous ID of the user. */
  anonymousId: string
}

const hashAnonymousId = 'anonymousId'

export function isAnonymousId<V>(v: V) {
  return is$typed(v, id, hashAnonymousId)
}

export function validateAnonymousId<V>(v: V) {
  return validate<AnonymousId & V>(v, id, hashAnonymousId)
}
