/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'
import type * as ComAtprotoRepoStrongRef from '../../com/atproto/repo/strongRef.js'
import type * as AtCozyCornerDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.avatar'

export interface Main {
  $type: 'at.cozy-corner.avatar'
  baseAvatar?: ComAtprotoRepoStrongRef.Main
  /** Tints for the base avatar layers */
  baseAvatarTints?: AtCozyCornerDefs.LayerTint[]
  baseAvatarTransform?: AtCozyCornerDefs.Transform
  /** Equipped wearables in composite order (first = bottom layer). Each entry references a wearable and can override tint/offset. */
  wearables?: EquippedWearable[]
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

/** A wearable equipped on an avatar, with per-equip overrides. */
export interface EquippedWearable {
  $type?: 'at.cozy-corner.avatar#equippedWearable'
  wearable: ComAtprotoRepoStrongRef.Main
  /** Tints for the wearable layers */
  tints?: AtCozyCornerDefs.LayerTint[]
  transform?: AtCozyCornerDefs.Transform
  /** State values for this equipped wearable, overriding stateProperty defaults. */
  state?: AtCozyCornerDefs.StateValue[]
}

const hashEquippedWearable = 'equippedWearable'

export function isEquippedWearable<V>(v: V) {
  return is$typed(v, id, hashEquippedWearable)
}

export function validateEquippedWearable<V>(v: V) {
  return validate<EquippedWearable & V>(v, id, hashEquippedWearable)
}
