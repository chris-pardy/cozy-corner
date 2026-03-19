/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'at.cozy-corner.behavior'

export interface Behavior {
  $type?: 'at.cozy-corner.behavior#behavior'
  /** The name of the behavior */
  name?: string
  on: string[]
  queries?: (
    | $Typed<BestTileQuery>
    | $Typed<MatchTileQuery>
    | $Typed<NearestEntityQuery>
    | { $type: string }
  )[]
  when?:
    | $Typed<AndComparison>
    | $Typed<OrComparison>
    | $Typed<NotComparison>
    | $Typed<ChanceComparison>
    | $Typed<ExistsComparison>
    | $Typed<GreaterThanComparison>
    | $Typed<LessThanComparison>
    | $Typed<EqualToComparison>
    | { $type: string }
  /** If true (default), the event is consumed when this behavior's condition passes — no further behaviors on this entity handle it, and the event does not propagate to children. Set to false to allow other behaviors and children to also handle the event. */
  consumed: boolean
  emit: Event[]
}

const hashBehavior = 'behavior'

export function isBehavior<V>(v: V) {
  return is$typed(v, id, hashBehavior)
}

export function validateBehavior<V>(v: V) {
  return validate<Behavior & V>(v, id, hashBehavior)
}

/** A query for the best tile matching a weighted set of attributes */
export interface BestTileQuery {
  $type?: 'at.cozy-corner.behavior#bestTileQuery'
  type: 'bestTile'
  /** The name of the query */
  name: string
  /** The radius of the query */
  range: number
  /** The direction of the query, bitmask, 1 = south, 2 = north, 4 = east, 8 = west */
  direction: number
  attributes: QueryAttribute[]
}

const hashBestTileQuery = 'bestTileQuery'

export function isBestTileQuery<V>(v: V) {
  return is$typed(v, id, hashBestTileQuery)
}

export function validateBestTileQuery<V>(v: V) {
  return validate<BestTileQuery & V>(v, id, hashBestTileQuery)
}

/** A query for the nearest tile where all attributes satisfy their comparison conditions */
export interface MatchTileQuery {
  $type?: 'at.cozy-corner.behavior#matchTileQuery'
  type: 'matchTile'
  /** The name of the query */
  name: string
  /** The radius of the query */
  range: number
  /** The direction of the query, bitmask, 1 = south, 2 = north, 4 = east, 8 = west */
  direction: number
  attributes: MatchAttribute[]
}

const hashMatchTileQuery = 'matchTileQuery'

export function isMatchTileQuery<V>(v: V) {
  return is$typed(v, id, hashMatchTileQuery)
}

export function validateMatchTileQuery<V>(v: V) {
  return validate<MatchTileQuery & V>(v, id, hashMatchTileQuery)
}

/** Find the nearest sibling entity whose behavior state matches all specified conditions. Returns x, y, distance in the query result. Excludes the querying entity itself. */
export interface NearestEntityQuery {
  $type?: 'at.cozy-corner.behavior#nearestEntityQuery'
  type: 'nearestEntity'
  /** The name of the query result */
  name: string
  /** Maximum Manhattan distance to search */
  range: number
  /** Direction bitmask filter, 1 = south, 2 = north, 4 = east, 8 = west */
  direction: number
  /** State conditions that must all match on the target entity's behavior state */
  match?: EntityMatch[]
}

const hashNearestEntityQuery = 'nearestEntityQuery'

export function isNearestEntityQuery<V>(v: V) {
  return is$typed(v, id, hashNearestEntityQuery)
}

export function validateNearestEntityQuery<V>(v: V) {
  return validate<NearestEntityQuery & V>(v, id, hashNearestEntityQuery)
}

/** A condition on an entity's behavior state. If value is omitted, checks existence. If comparison is omitted, defaults to equality. */
export interface EntityMatch {
  $type?: 'at.cozy-corner.behavior#entityMatch'
  /** The behavior state key to check */
  state: string
  /** The comparison operation. Defaults to 'eq' when omitted. */
  comparison?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  value?: $Typed<Value> | $Typed<StringValue> | { $type: string }
}

const hashEntityMatch = 'entityMatch'

export function isEntityMatch<V>(v: V) {
  return is$typed(v, id, hashEntityMatch)
}

export function validateEntityMatch<V>(v: V) {
  return validate<EntityMatch & V>(v, id, hashEntityMatch)
}

export interface QueryAttribute {
  $type?: 'at.cozy-corner.behavior#queryAttribute'
  /** The name of the attribute to query */
  attribute?: string
  /** The value of the attribute to query, -100 to 100 shifted to 0 to 200 */
  value?: number
}

const hashQueryAttribute = 'queryAttribute'

export function isQueryAttribute<V>(v: V) {
  return is$typed(v, id, hashQueryAttribute)
}

export function validateQueryAttribute<V>(v: V) {
  return validate<QueryAttribute & V>(v, id, hashQueryAttribute)
}

export interface MatchAttribute {
  $type?: 'at.cozy-corner.behavior#matchAttribute'
  /** The name of the attribute to match */
  attribute: string
  /** The comparison operation */
  comparison: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'neq'
  /** The value to compare against */
  value: number
}

const hashMatchAttribute = 'matchAttribute'

export function isMatchAttribute<V>(v: V) {
  return is$typed(v, id, hashMatchAttribute)
}

export function validateMatchAttribute<V>(v: V) {
  return validate<MatchAttribute & V>(v, id, hashMatchAttribute)
}

/** A comparison of two or more attributes using the AND operator */
export interface AndComparison {
  $type?: 'at.cozy-corner.behavior#andComparison'
  and: (
    | $Typed<AndComparison>
    | $Typed<OrComparison>
    | $Typed<NotComparison>
    | $Typed<ChanceComparison>
    | $Typed<GreaterThanComparison>
    | $Typed<LessThanComparison>
    | $Typed<EqualToComparison>
    | { $type: string }
  )[]
}

const hashAndComparison = 'andComparison'

export function isAndComparison<V>(v: V) {
  return is$typed(v, id, hashAndComparison)
}

export function validateAndComparison<V>(v: V) {
  return validate<AndComparison & V>(v, id, hashAndComparison)
}

/** A comparison of two or more attributes using the OR operator */
export interface OrComparison {
  $type?: 'at.cozy-corner.behavior#orComparison'
  or: (
    | $Typed<AndComparison>
    | $Typed<OrComparison>
    | $Typed<NotComparison>
    | $Typed<ChanceComparison>
    | $Typed<GreaterThanComparison>
    | $Typed<LessThanComparison>
    | $Typed<EqualToComparison>
    | { $type: string }
  )[]
}

const hashOrComparison = 'orComparison'

export function isOrComparison<V>(v: V) {
  return is$typed(v, id, hashOrComparison)
}

export function validateOrComparison<V>(v: V) {
  return validate<OrComparison & V>(v, id, hashOrComparison)
}

/** A negation of a comparison */
export interface NotComparison {
  $type?: 'at.cozy-corner.behavior#notComparison'
  not:
    | $Typed<AndComparison>
    | $Typed<OrComparison>
    | $Typed<NotComparison>
    | $Typed<GreaterThanComparison>
    | $Typed<LessThanComparison>
    | $Typed<EqualToComparison>
    | { $type: string }
}

const hashNotComparison = 'notComparison'

export function isNotComparison<V>(v: V) {
  return is$typed(v, id, hashNotComparison)
}

export function validateNotComparison<V>(v: V) {
  return validate<NotComparison & V>(v, id, hashNotComparison)
}

/** Evaluates to true with the given probability. Used for stochastic timing (e.g. random cooldowns on tick events). */
export interface ChanceComparison {
  $type?: 'at.cozy-corner.behavior#chanceComparison'
  /** Probability per evaluation, from 0 (never) to 10000 (always). For tick-based cooldowns at ~60fps: 167 ≈ 1s mean wait, 30 ≈ 5.5s, 17 ≈ 10s. */
  chance: number
}

const hashChanceComparison = 'chanceComparison'

export function isChanceComparison<V>(v: V) {
  return is$typed(v, id, hashChanceComparison)
}

export function validateChanceComparison<V>(v: V) {
  return validate<ChanceComparison & V>(v, id, hashChanceComparison)
}

export interface ExistsComparison {
  $type?: 'at.cozy-corner.behavior#existsComparison'
  exists:
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<EventValue>
    | { $type: string }
}

const hashExistsComparison = 'existsComparison'

export function isExistsComparison<V>(v: V) {
  return is$typed(v, id, hashExistsComparison)
}

export function validateExistsComparison<V>(v: V) {
  return validate<ExistsComparison & V>(v, id, hashExistsComparison)
}

export interface GreaterThanComparison {
  $type?: 'at.cozy-corner.behavior#greaterThanComparison'
  compare:
    | $Typed<Value>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AttributeAt>
    | $Typed<TimeSince>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
  greaterThan:
    | $Typed<Value>
    | $Typed<QueryResult>
    | $Typed<EventValue>
    | $Typed<EntityState>
    | $Typed<AttributeAt>
    | $Typed<TimeSince>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
}

const hashGreaterThanComparison = 'greaterThanComparison'

export function isGreaterThanComparison<V>(v: V) {
  return is$typed(v, id, hashGreaterThanComparison)
}

export function validateGreaterThanComparison<V>(v: V) {
  return validate<GreaterThanComparison & V>(v, id, hashGreaterThanComparison)
}

export interface LessThanComparison {
  $type?: 'at.cozy-corner.behavior#lessThanComparison'
  compare:
    | $Typed<Value>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AttributeAt>
    | $Typed<TimeSince>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
  lessThan:
    | $Typed<Value>
    | $Typed<QueryResult>
    | $Typed<EventValue>
    | $Typed<EntityState>
    | $Typed<AttributeAt>
    | $Typed<TimeSince>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
}

const hashLessThanComparison = 'lessThanComparison'

export function isLessThanComparison<V>(v: V) {
  return is$typed(v, id, hashLessThanComparison)
}

export function validateLessThanComparison<V>(v: V) {
  return validate<LessThanComparison & V>(v, id, hashLessThanComparison)
}

export interface EqualToComparison {
  $type?: 'at.cozy-corner.behavior#equalToComparison'
  compare:
    | $Typed<Value>
    | $Typed<StringValue>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AttributeAt>
    | $Typed<TimeSince>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
  equalTo:
    | $Typed<Value>
    | $Typed<StringValue>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AttributeAt>
    | $Typed<TimeSince>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
}

const hashEqualToComparison = 'equalToComparison'

export function isEqualToComparison<V>(v: V) {
  return is$typed(v, id, hashEqualToComparison)
}

export function validateEqualToComparison<V>(v: V) {
  return validate<EqualToComparison & V>(v, id, hashEqualToComparison)
}

export interface Value {
  $type?: 'at.cozy-corner.behavior#value'
  /** The value to compare to */
  value: number
}

const hashValue = 'value'

export function isValue<V>(v: V) {
  return is$typed(v, id, hashValue)
}

export function validateValue<V>(v: V) {
  return validate<Value & V>(v, id, hashValue)
}

export interface StringValue {
  $type?: 'at.cozy-corner.behavior#stringValue'
  /** The string value to compare to */
  stringValue: string
}

const hashStringValue = 'stringValue'

export function isStringValue<V>(v: V) {
  return is$typed(v, id, hashStringValue)
}

export function validateStringValue<V>(v: V) {
  return validate<StringValue & V>(v, id, hashStringValue)
}

export interface EventValue {
  $type?: 'at.cozy-corner.behavior#eventValue'
  /** The name of the property */
  property: string
}

const hashEventValue = 'eventValue'

export function isEventValue<V>(v: V) {
  return is$typed(v, id, hashEventValue)
}

export function validateEventValue<V>(v: V) {
  return validate<EventValue & V>(v, id, hashEventValue)
}

export interface QueryResult {
  $type?: 'at.cozy-corner.behavior#queryResult'
  /** The name of the query */
  queryName: string
  /** The property of the query result to compare to */
  property: string
}

const hashQueryResult = 'queryResult'

export function isQueryResult<V>(v: V) {
  return is$typed(v, id, hashQueryResult)
}

export function validateQueryResult<V>(v: V) {
  return validate<QueryResult & V>(v, id, hashQueryResult)
}

export interface EntityState {
  $type?: 'at.cozy-corner.behavior#entityState'
  entity:
    | $Typed<EntityTarget>
    | $Typed<EntityAt>
    | $Typed<EntityId>
    | $Typed<EntityParent>
    | { $type: string }
  /** The state key for the entity */
  state: string
}

const hashEntityState = 'entityState'

export function isEntityState<V>(v: V) {
  return is$typed(v, id, hashEntityState)
}

export function validateEntityState<V>(v: V) {
  return validate<EntityState & V>(v, id, hashEntityState)
}

export interface EntityTarget {
  $type?: 'at.cozy-corner.behavior#entityTarget'
  target: 'self' | 'target'
}

const hashEntityTarget = 'entityTarget'

export function isEntityTarget<V>(v: V) {
  return is$typed(v, id, hashEntityTarget)
}

export function validateEntityTarget<V>(v: V) {
  return validate<EntityTarget & V>(v, id, hashEntityTarget)
}

/** Reference an entity at a specific grid position (for reading state only, not as an emit target). */
export interface EntityAt {
  $type?: 'at.cozy-corner.behavior#entityAt'
  atX:
    | $Typed<Value>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
  atY:
    | $Typed<Value>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
}

const hashEntityAt = 'entityAt'

export function isEntityAt<V>(v: V) {
  return is$typed(v, id, hashEntityAt)
}

export function validateEntityAt<V>(v: V) {
  return validate<EntityAt & V>(v, id, hashEntityAt)
}

/** Reference an entity by its behavior:id state value (for reading state only, not as an emit target). */
export interface EntityId {
  $type?: 'at.cozy-corner.behavior#entityId'
  id:
    | $Typed<StringValue>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | { $type: string }
}

const hashEntityId = 'entityId'

export function isEntityId<V>(v: V) {
  return is$typed(v, id, hashEntityId)
}

export function validateEntityId<V>(v: V) {
  return validate<EntityId & V>(v, id, hashEntityId)
}

export interface AttributeAt {
  $type?: 'at.cozy-corner.behavior#attributeAt'
  /** The name of the attribute to read */
  attribute: string
  atX:
    | $Typed<Value>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
  atY:
    | $Typed<Value>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
}

const hashAttributeAt = 'attributeAt'

export function isAttributeAt<V>(v: V) {
  return is$typed(v, id, hashAttributeAt)
}

export function validateAttributeAt<V>(v: V) {
  return validate<AttributeAt & V>(v, id, hashAttributeAt)
}

/** Computes elapsed milliseconds since a stored timestamp: (current event time − timestamp). The timestamp source must resolve to a numeric value (e.g. from entityState set via setState). */
export interface TimeSince {
  $type?: 'at.cozy-corner.behavior#timeSince'
  timestamp:
    | $Typed<Value>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | { $type: string }
}

const hashTimeSince = 'timeSince'

export function isTimeSince<V>(v: V) {
  return is$typed(v, id, hashTimeSince)
}

export function validateTimeSince<V>(v: V) {
  return validate<TimeSince & V>(v, id, hashTimeSince)
}

/** Numeric addition: resolves to add[0] + add[1]. */
export interface AddValue {
  $type?: 'at.cozy-corner.behavior#addValue'
  add: (
    | $Typed<Value>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AttributeAt>
    | $Typed<TimeSince>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
  )[]
}

const hashAddValue = 'addValue'

export function isAddValue<V>(v: V) {
  return is$typed(v, id, hashAddValue)
}

export function validateAddValue<V>(v: V) {
  return validate<AddValue & V>(v, id, hashAddValue)
}

/** Numeric subtraction: resolves to subtract[0] − subtract[1]. */
export interface SubtractValue {
  $type?: 'at.cozy-corner.behavior#subtractValue'
  subtract: (
    | $Typed<Value>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AttributeAt>
    | $Typed<TimeSince>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
  )[]
}

const hashSubtractValue = 'subtractValue'

export function isSubtractValue<V>(v: V) {
  return is$typed(v, id, hashSubtractValue)
}

export function validateSubtractValue<V>(v: V) {
  return validate<SubtractValue & V>(v, id, hashSubtractValue)
}

/** References the parent entity in the entity tree. */
export interface EntityParent {
  $type?: 'at.cozy-corner.behavior#entityParent'
  kind?: 'parent'
}

const hashEntityParent = 'entityParent'

export function isEntityParent<V>(v: V) {
  return is$typed(v, id, hashEntityParent)
}

export function validateEntityParent<V>(v: V) {
  return validate<EntityParent & V>(v, id, hashEntityParent)
}

/** References all children of the entity. Only valid as an emit target — the event is broadcast to each child. */
export interface EntityChildren {
  $type?: 'at.cozy-corner.behavior#entityChildren'
  kind?: 'children'
}

const hashEntityChildren = 'entityChildren'

export function isEntityChildren<V>(v: V) {
  return is$typed(v, id, hashEntityChildren)
}

export function validateEntityChildren<V>(v: V) {
  return validate<EntityChildren & V>(v, id, hashEntityChildren)
}

export interface Event {
  $type?: 'at.cozy-corner.behavior#event'
  type: 'moveTo' | 'setState' | 'target' | (string & {})
  target?:
    | $Typed<EntityTarget>
    | $Typed<EntityParent>
    | $Typed<EntityChildren>
    | { $type: string }
  properties?: EventProperty[]
}

const hashEvent = 'event'

export function isEvent<V>(v: V) {
  return is$typed(v, id, hashEvent)
}

export function validateEvent<V>(v: V) {
  return validate<Event & V>(v, id, hashEvent)
}

export interface EventProperty {
  $type?: 'at.cozy-corner.behavior#eventProperty'
  /** The name of the property */
  name: string
  value:
    | $Typed<Value>
    | $Typed<StringValue>
    | $Typed<EventValue>
    | $Typed<QueryResult>
    | $Typed<EntityState>
    | $Typed<AttributeAt>
    | $Typed<TimeSince>
    | $Typed<AddValue>
    | $Typed<SubtractValue>
    | { $type: string }
}

const hashEventProperty = 'eventProperty'

export function isEventProperty<V>(v: V) {
  return is$typed(v, id, hashEventProperty)
}

export function validateEventProperty<V>(v: V) {
  return validate<EventProperty & V>(v, id, hashEventProperty)
}
