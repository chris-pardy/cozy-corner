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
const id = 'at.cozy-corner.tileset'

export interface Main {
  $type: 'at.cozy-corner.tileset'
  /** Display name for the tileset. */
  name: string
  /** Free-form description of the tileset. */
  description?: string
  /** Tags for the tileset. */
  tags?: string[]
  spriteSheet: BlobRef
  /** Layers in the tileset */
  layers: AtCozyCornerDefs.AnimationLayer[]
  /** Tiles in the tileset */
  tiles: Tile[]
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

/** A tile in the tileset */
export interface Tile {
  $type?: 'at.cozy-corner.tileset#tile'
  /** The name of the tile */
  name: string
  /** The target of the tile in the layers */
  target?: string
  /** Whether this tile is a wall. Used to auto-generate blocking edges in the room editor. */
  wall?: boolean
}

const hashTile = 'tile'

export function isTile<V>(v: V) {
  return is$typed(v, id, hashTile)
}

export function validateTile<V>(v: V) {
  return validate<Tile & V>(v, id, hashTile)
}
