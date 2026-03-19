/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AtCozyCornerHouseDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.house.updatePresence'

export type QueryParams = {}
export type InputSchema =
  | $Typed<MoveTo>
  | $Typed<Activate>
  | $Typed<Say>
  | $Typed<PromptResponse>
  | { $type: string }

export interface OutputSchema {
  id:
    | $Typed<AtCozyCornerHouseDefs.Did>
    | $Typed<AtCozyCornerHouseDefs.AnonymousId>
    | { $type: string }
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

/** Move avatar to a target tile. Server runs pathfinding authoritatively. */
export interface MoveTo {
  $type?: 'at.cozy-corner.house.updatePresence#moveTo'
  type: 'moveTo'
  /** Target tile x position. */
  x: number
  /** Target tile y position. */
  y: number
}

const hashMoveTo = 'moveTo'

export function isMoveTo<V>(v: V) {
  return is$typed(v, id, hashMoveTo)
}

export function validateMoveTo<V>(v: V) {
  return validate<MoveTo & V>(v, id, hashMoveTo)
}

/** Activate the entity at the given tile. */
export interface Activate {
  $type?: 'at.cozy-corner.house.updatePresence#activate'
  type: 'activate'
  /** Target tile x position. */
  x: number
  /** Target tile y position. */
  y: number
}

const hashActivate = 'activate'

export function isActivate<V>(v: V) {
  return is$typed(v, id, hashActivate)
}

export function validateActivate<V>(v: V) {
  return validate<Activate & V>(v, id, hashActivate)
}

/** Express an emoji in a speech or thought bubble. */
export interface Say {
  $type?: 'at.cozy-corner.house.updatePresence#say'
  type: 'say'
  /** The emoji character(s) to display. */
  emoji: string
  /** Bubble style. */
  bubble: 'thought' | 'speech'
}

const hashSay = 'say'

export function isSay<V>(v: V) {
  return is$typed(v, id, hashSay)
}

export function validateSay<V>(v: V) {
  return validate<Say & V>(v, id, hashSay)
}

/** Respond to an active prompt from an NPC or item. */
export interface PromptResponse {
  $type?: 'at.cozy-corner.house.updatePresence#promptResponse'
  type: 'promptResponse'
  /** The selected response option. */
  response: string
}

const hashPromptResponse = 'promptResponse'

export function isPromptResponse<V>(v: V) {
  return is$typed(v, id, hashPromptResponse)
}

export function validatePromptResponse<V>(v: V) {
  return validate<PromptResponse & V>(v, id, hashPromptResponse)
}
