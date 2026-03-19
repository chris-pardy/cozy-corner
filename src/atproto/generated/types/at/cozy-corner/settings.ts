/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.settings'

export interface Main {
  $type: 'at.cozy-corner.settings'
  /** Preferred front-end services for viewing linked AT Protocol content in iframe overlays. Each entry maps a record collection to a preferred service. When a linkAction is triggered, the client looks up the collection NSID from the at-uri and uses the matching service handler to construct the embed URL. If no handler is configured, the client falls back to a built-in default. */
  serviceHandlers?: ServiceHandler[]
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

/** Maps an AT Protocol record collection to a web front-end URL for iframe embedding. The urlTemplate is interpolated with {{authority}} (DID or handle) and {{key}} (record key) to produce the embed URL. */
export interface ServiceHandler {
  $type?: 'at.cozy-corner.settings#serviceHandler'
  /** NSID of the record collection this handler applies to. */
  collection: 'app.bsky.feed.post' | 'com.whtwnd.blog.entry' | (string & {})
  /** URL template for embedding content. Use {{authority}} for the DID/handle and {{key}} for the record key. Example: 'https://bsky.app/profile/{{authority}}/post/{{key}}'. */
  urlTemplate: string
}

const hashServiceHandler = 'serviceHandler'

export function isServiceHandler<V>(v: V) {
  return is$typed(v, id, hashServiceHandler)
}

export function validateServiceHandler<V>(v: V) {
  return validate<ServiceHandler & V>(v, id, hashServiceHandler)
}
