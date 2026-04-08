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
const id = 'at.cozy-corner.room'

export interface Main {
  $type: 'at.cozy-corner.room'
  /** Display name for the room (e.g. Kitchen, Bedroom). */
  name: string
  tileset: ComAtprotoRepoStrongRef.Main
  /** Tiles positioned in the room */
  tiles: Tile[]
  background?:
    | $Typed<BackgroundImage>
    | $Typed<BackgroundColor>
    | $Typed<BackgroundGradient>
    | { $type: string }
  /** Items placed in the room */
  items?: RoomItem[]
  /** npcs placed in the room. Each entry spawns an npc at the given position. */
  npcs?: RoomNpc[]
  /** Lua scripts that define how this room responds to events (e.g. cutscenes on enter, ambient effects). */
  behaviors?: AtCozyCornerDefs.Behavior[]
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

/** A per-tile attribute score array. Values use the 0-100 scale */
export interface TileAttribute {
  $type?: 'at.cozy-corner.room#tileAttribute'
  /** Attribute name (e.g. 'light', 'heat', 'sound'). */
  attribute: string
  /** Each value is 0-100 where 100 is neutral. */
  value: number
}

const hashTileAttribute = 'tileAttribute'

export function isTileAttribute<V>(v: V) {
  return is$typed(v, id, hashTileAttribute)
}

export function validateTileAttribute<V>(v: V) {
  return validate<TileAttribute & V>(v, id, hashTileAttribute)
}

/** A tile position within a room */
export interface Tile {
  $type?: 'at.cozy-corner.room#tile'
  /** Layers for the tile */
  layers?: TileLayer[]
  /** The x position of the tile in the room */
  x: number
  /** The y position of the tile in the room */
  y: number
  /** Each value is a bitmask: bits 0-3 = physical blocking per direction (N=1, E=2, S=4, W=8), bits 4-7 = ephemeral blocking per direction (N=16, E=32, S=64, W=128). Physical blocks movement; ephemeral blocks light/sound/heat. A fully blocked tile has value 15 (physical) or 255 (both). 0 = no blocking. */
  blocking: number
  /** Whether this tile is a valid spawn tile. If omitted or false, the tile is not a valid spawn tile. */
  spawn: boolean
  exit?: $Typed<Exit> | $Typed<SelfExit> | { $type: string }
  /** Attributes for the tile */
  attributes?: TileAttribute[]
}

const hashTile = 'tile'

export function isTile<V>(v: V) {
  return is$typed(v, id, hashTile)
}

export function validateTile<V>(v: V) {
  return validate<Tile & V>(v, id, hashTile)
}

/** A transformed animated layer for a tile */
export interface TileLayer {
  $type?: 'at.cozy-corner.room#tileLayer'
  /** The unique id of the tile (unique within the tileset) */
  tileId: string
  /** Display name for the layer (e.g. Floor, Walls, Canopy). */
  layerName?: string
  /** Tints for the tile layers */
  tints?: AtCozyCornerDefs.ChannelTint[]
  /** Packed tile transform. Bits 0-2: rotation (0=0°, 1=90°, 2=180°, 3=270°). Bit 3: horizontal mirror. Bit 4: vertical mirror. */
  transform: number
  /** The layer to render the tile on, 0 = background, 1 = foreground, 2 = overhead */
  renderLayer?: number
}

const hashTileLayer = 'tileLayer'

export function isTileLayer<V>(v: V) {
  return is$typed(v, id, hashTileLayer)
}

export function validateTileLayer<V>(v: V) {
  return validate<TileLayer & V>(v, id, hashTileLayer)
}

/** A an item placed in the room */
export interface RoomItem {
  $type?: 'at.cozy-corner.room#roomItem'
  item: ComAtprotoRepoStrongRef.Main
  /** The variant of the item to use */
  variantId: string
  /** The x position of the item in the room */
  x: number
  /** The y position of the item in the room */
  y: number
  /** Tints for the item layers */
  tints?: AtCozyCornerDefs.ChannelTint[]
  /** State values for this placement, overriding variant and stateProperty defaults. */
  state?: AtCozyCornerDefs.StateValue[]
}

const hashRoomItem = 'roomItem'

export function isRoomItem<V>(v: V) {
  return is$typed(v, id, hashRoomItem)
}

export function validateRoomItem<V>(v: V) {
  return validate<RoomItem & V>(v, id, hashRoomItem)
}

/** A background image rendered behind the tile grid (e.g. sky, landscape for outdoor rooms). */
export interface BackgroundImage {
  $type?: 'at.cozy-corner.room#backgroundImage'
  /** The background image. */
  image: BlobRef
}

const hashBackgroundImage = 'backgroundImage'

export function isBackgroundImage<V>(v: V) {
  return is$typed(v, id, hashBackgroundImage)
}

export function validateBackgroundImage<V>(v: V) {
  return validate<BackgroundImage & V>(v, id, hashBackgroundImage)
}

/** A solid color background rendered behind the tile grid. */
export interface BackgroundColor {
  $type?: 'at.cozy-corner.room#backgroundColor'
  /** Hex color value (e.g. #1a1a2e, #87ceeb). */
  color: string
}

const hashBackgroundColor = 'backgroundColor'

export function isBackgroundColor<V>(v: V) {
  return is$typed(v, id, hashBackgroundColor)
}

export function validateBackgroundColor<V>(v: V) {
  return validate<BackgroundColor & V>(v, id, hashBackgroundColor)
}

/** A gradient background rendered behind the tile grid. */
export interface BackgroundGradient {
  $type?: 'at.cozy-corner.room#backgroundGradient'
  /** Gradient angle in degrees. 0 = top to bottom, 90 = left to right, 180 = bottom to top. */
  angle: number
  /** Gradient color stops. Must have at least 2. */
  stops: GradientStop[]
}

const hashBackgroundGradient = 'backgroundGradient'

export function isBackgroundGradient<V>(v: V) {
  return is$typed(v, id, hashBackgroundGradient)
}

export function validateBackgroundGradient<V>(v: V) {
  return validate<BackgroundGradient & V>(v, id, hashBackgroundGradient)
}

/** A color stop in a gradient. */
export interface GradientStop {
  $type?: 'at.cozy-corner.room#gradientStop'
  /** Hex color value (e.g. #1a1a2e). */
  color: string
  /** Position along the gradient as a percentage (0-100). If omitted, stops are evenly distributed. */
  position?: number
}

const hashGradientStop = 'gradientStop'

export function isGradientStop<V>(v: V) {
  return is$typed(v, id, hashGradientStop)
}

export function validateGradientStop<V>(v: V) {
  return validate<GradientStop & V>(v, id, hashGradientStop)
}

/** A doorway or passage connecting this room to another. */
export interface Exit {
  $type?: 'at.cozy-corner.room#exit'
  /** The unique id of the exit (unique within the room) */
  id: string
  /** Display label for the exit (e.g. Upstairs, Kitchen). */
  label?: string
  target: ComAtprotoRepoStrongRef.Main
  /** The unique id of the exit in the target room */
  targetExitId?: string
  /** A bitmask of the direction the player must walk to traverse the exit. N=1, E=2, S=4, W=8 */
  direction: number
}

const hashExit = 'exit'

export function isExit<V>(v: V) {
  return is$typed(v, id, hashExit)
}

export function validateExit<V>(v: V) {
  return validate<Exit & V>(v, id, hashExit)
}

/** An exit that connects this room to itself */
export interface SelfExit {
  $type?: 'at.cozy-corner.room#selfExit'
  /** The unique id of the exit (unique within the room) */
  id: string
  /** Display label for the exit (e.g. Upstairs, Kitchen). */
  label?: string
  /** The unique id of the exit in the target room */
  targetExitId: string
  /** A bitmask of the direction the player must walk to traverse the exit. N=1, E=2, S=4, W=8 */
  direction: number
}

const hashSelfExit = 'selfExit'

export function isSelfExit<V>(v: V) {
  return is$typed(v, id, hashSelfExit)
}

export function validateSelfExit<V>(v: V) {
  return validate<SelfExit & V>(v, id, hashSelfExit)
}

/** A npc placed in the room. */
export interface RoomNpc {
  $type?: 'at.cozy-corner.room#roomNpc'
  npc: ComAtprotoRepoStrongRef.Main
  /** The x position of the npc in the room */
  x: number
  /** The y position of the npc in the room */
  y: number
  /** Override display name for this npc instance (e.g. Mr. Whiskers). */
  name?: string
  /** Tints for the npc layers */
  tints?: AtCozyCornerDefs.ChannelTint[]
  /** State values for this npc placement, overriding stateProperty defaults. */
  state?: AtCozyCornerDefs.StateValue[]
}

const hashRoomNpc = 'roomNpc'

export function isRoomNpc<V>(v: V) {
  return is$typed(v, id, hashRoomNpc)
}

export function validateRoomNpc<V>(v: V) {
  return validate<RoomNpc & V>(v, id, hashRoomNpc)
}
