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
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js'
import type * as AtCozyCornerScript from '../script.js'
import type * as AtCozyCornerDefs from '../defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.house.room'

export interface Main {
  $type: 'at.cozy-corner.house.room'
  /** Grid width of the room in tiles. All flat grid arrays (spawnTiles, blockingEdges, tileAttributes values) use this as their row stride. */
  width: number
  /** Display name for the room (e.g. Kitchen, Bedroom). */
  name: string
  tileset: ComAtprotoRepoStrongRef.Main
  /** Tiles positioned in the room */
  tiles: TilePosition[]
  /** Per-tile edge blocking as a flat array of width * height (row-major). Each value is a bitmask: bits 0-3 = physical blocking per direction (N=1, E=2, S=4, W=8), bits 4-7 = ephemeral blocking per direction (N=16, E=32, S=64, W=128). Physical blocks movement; ephemeral blocks light/sound/heat. A fully blocked tile has value 15 (physical) or 255 (both). 0 = no blocking. */
  blockingEdges?: number[]
  background?:
    | $Typed<BackgroundImage>
    | $Typed<BackgroundColor>
    | $Typed<BackgroundGradient>
    | { $type: string }
  /** Per-tile spawn mask as a flat array of width * height (row-major). 1 = valid spawn tile, 0 = not spawnable. Players entering this room from outside appear at a random valid tile. If omitted or empty, players spawn at (0, 0). */
  spawnTiles?: number[]
  /** Connections to other rooms. */
  exits?: Exit[]
  /** Items placed in the room */
  items?: RoomItem[]
  /** Critters placed in the room. Each entry spawns an autonomous creature at the given position. */
  critters?: RoomCritter[]
  /** Per-tile attribute scores (e.g. lighting, heat). Each entry defines one attribute with a flat width*height value array (row-major). */
  tileAttributes?: TileAttribute[]
  /** Lua scripts that define how this room responds to events (e.g. cutscenes on enter, ambient effects). */
  behaviors?: AtCozyCornerScript.Script[]
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

/** A per-tile attribute score array. Values use the same 0-200 scale as movementAttribute (100 = neutral). */
export interface TileAttribute {
  $type?: 'at.cozy-corner.house.room#tileAttribute'
  /** Attribute name (e.g. 'light', 'heat', 'sound'). */
  attribute: string
  /** Flat array of width * height values (row-major). Each value is 0-200 where 100 is neutral. */
  values: number[]
}

const hashTileAttribute = 'tileAttribute'

export function isTileAttribute<V>(v: V) {
  return is$typed(v, id, hashTileAttribute)
}

export function validateTileAttribute<V>(v: V) {
  return validate<TileAttribute & V>(v, id, hashTileAttribute)
}

/** A tile position within a room */
export interface TilePosition {
  $type?: 'at.cozy-corner.house.room#tilePosition'
  /** Display name for the layer (e.g. Floor, Walls, Canopy). */
  layerName?: string
  /** The tile index in the tileset */
  tile: number
  /** The x position of the tile in the room */
  x: number
  /** The y position of the tile in the room */
  y: number
  /** Tints for the tile */
  tints?: AtCozyCornerDefs.ChannelTint[]
  /** Packed tile transform. Bits 0-1: rotation (0=0°, 1=90°, 2=180°, 3=270°). Bit 2: horizontal mirror. Bit 3: vertical mirror. */
  transform?: number
  /** The layer to render the tile on, 0 = background, 1 = foreground, 2 = overhead */
  renderLayer?: number
}

const hashTilePosition = 'tilePosition'

export function isTilePosition<V>(v: V) {
  return is$typed(v, id, hashTilePosition)
}

export function validateTilePosition<V>(v: V) {
  return validate<TilePosition & V>(v, id, hashTilePosition)
}

/** A an item placed in the room */
export interface RoomItem {
  $type?: 'at.cozy-corner.house.room#roomItem'
  item: ComAtprotoRepoStrongRef.Main
  /** The variant of the item to use */
  variant?: number
  /** The x position of the item in the room */
  x: number
  /** The y position of the item in the room */
  y: number
  /** Tints for the item layers */
  tints?: AtCozyCornerDefs.ChannelTint[]
  transform?: AtCozyCornerDefs.Transform
  /** State values for this placement, overriding variant and stateProperty defaults. */
  state?: AtCozyCornerDefs.StateValue[]
  /** 1 if the item is painted on the front layer, 0 if it is painted behind */
  foreground?: number
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
  $type?: 'at.cozy-corner.house.room#backgroundImage'
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
  $type?: 'at.cozy-corner.house.room#backgroundColor'
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
  $type?: 'at.cozy-corner.house.room#backgroundGradient'
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
  $type?: 'at.cozy-corner.house.room#gradientStop'
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

/** A doorway or passage connecting this room to another. The exit occupies a rectangular region of tiles. To traverse a room exit the player must walk in the given direction while standing on an exit tile, or click the exit tile a second time. */
export interface Exit {
  $type?: 'at.cozy-corner.house.room#exit'
  /** Display label for the exit (e.g. Upstairs, Kitchen). */
  label?: string
  target?: ComAtprotoRepoStrongRef.Main
  /** Index into the target room's exits array identifying where the player should spawn. Only trusted when the target room's current CID matches the strong ref CID; otherwise falls back to reciprocal exit matching. */
  targetExit?: number
  /** Tile x position of this exit in the room. */
  x: number
  /** Tile y position of this exit in the room. */
  y: number
  /** Width of the exit region in tiles. Defaults to 1. */
  width: number
  /** Height of the exit region in tiles. Defaults to 1. */
  height: number
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

/** A critter placed in the room. The area mask defines which tiles the critter can occupy (room.width * room.height, row-major, 1 = valid). The critter spawns at a random valid tile and roams within the area. */
export interface RoomCritter {
  $type?: 'at.cozy-corner.house.room#roomCritter'
  critter: ComAtprotoRepoStrongRef.Main
  /** Flat boolean mask of length room.width * room.height (row-major). 1 = tile the critter can occupy, 0 = off-limits. The critter spawns randomly on a valid tile. */
  area: number[]
  /** Override display name for this critter instance (e.g. Mr. Whiskers). */
  name?: string
  /** Tints for the critter layers */
  tints?: AtCozyCornerDefs.ChannelTint[]
  /** State values for this critter placement, overriding stateProperty defaults. */
  state?: AtCozyCornerDefs.StateValue[]
}

const hashRoomCritter = 'roomCritter'

export function isRoomCritter<V>(v: V) {
  return is$typed(v, id, hashRoomCritter)
}

export function validateRoomCritter<V>(v: V) {
  return validate<RoomCritter & V>(v, id, hashRoomCritter)
}
