/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  XrpcClient,
  type FetchHandler,
  type FetchHandlerOptions,
} from '@atproto/xrpc'
import { schemas } from './lexicons.js'
import { CID } from 'multiformats/cid'
import { type OmitKey, type Un$Typed } from './util.js'
import * as AtCozyCornerAvatar from './types/at/cozy-corner/avatar.js'
import * as AtCozyCornerAvatarBase from './types/at/cozy-corner/avatar/base.js'
import * as AtCozyCornerAvatarWearable from './types/at/cozy-corner/avatar/wearable.js'
import * as AtCozyCornerBehavior from './types/at/cozy-corner/behavior.js'
import * as AtCozyCornerCritter from './types/at/cozy-corner/critter.js'
import * as AtCozyCornerDefs from './types/at/cozy-corner/defs.js'
import * as AtCozyCornerHouse from './types/at/cozy-corner/house.js'
import * as AtCozyCornerHouseDefs from './types/at/cozy-corner/house/defs.js'
import * as AtCozyCornerHousePresence from './types/at/cozy-corner/house/presence.js'
import * as AtCozyCornerHouseRoom from './types/at/cozy-corner/house/room.js'
import * as AtCozyCornerHouseUpdatePresence from './types/at/cozy-corner/house/updatePresence.js'
import * as AtCozyCornerInventory from './types/at/cozy-corner/inventory.js'
import * as AtCozyCornerItem from './types/at/cozy-corner/item.js'
import * as AtCozyCornerScript from './types/at/cozy-corner/script.js'
import * as AtCozyCornerSettings from './types/at/cozy-corner/settings.js'
import * as AtCozyCornerStarterPack from './types/at/cozy-corner/starterPack.js'
import * as AtCozyCornerTileset from './types/at/cozy-corner/tileset.js'

export * as AtCozyCornerAvatar from './types/at/cozy-corner/avatar.js'
export * as AtCozyCornerAvatarBase from './types/at/cozy-corner/avatar/base.js'
export * as AtCozyCornerAvatarWearable from './types/at/cozy-corner/avatar/wearable.js'
export * as AtCozyCornerBehavior from './types/at/cozy-corner/behavior.js'
export * as AtCozyCornerCritter from './types/at/cozy-corner/critter.js'
export * as AtCozyCornerDefs from './types/at/cozy-corner/defs.js'
export * as AtCozyCornerHouse from './types/at/cozy-corner/house.js'
export * as AtCozyCornerHouseDefs from './types/at/cozy-corner/house/defs.js'
export * as AtCozyCornerHousePresence from './types/at/cozy-corner/house/presence.js'
export * as AtCozyCornerHouseRoom from './types/at/cozy-corner/house/room.js'
export * as AtCozyCornerHouseUpdatePresence from './types/at/cozy-corner/house/updatePresence.js'
export * as AtCozyCornerInventory from './types/at/cozy-corner/inventory.js'
export * as AtCozyCornerItem from './types/at/cozy-corner/item.js'
export * as AtCozyCornerScript from './types/at/cozy-corner/script.js'
export * as AtCozyCornerSettings from './types/at/cozy-corner/settings.js'
export * as AtCozyCornerStarterPack from './types/at/cozy-corner/starterPack.js'
export * as AtCozyCornerTileset from './types/at/cozy-corner/tileset.js'

export class AtpBaseClient extends XrpcClient {
  at: AtNS

  constructor(options: FetchHandler | FetchHandlerOptions) {
    super(options, schemas)
    this.at = new AtNS(this)
  }

  /** @deprecated use `this` instead */
  get xrpc(): XrpcClient {
    return this
  }
}

export class AtNS {
  _client: XrpcClient
  cozyCorner: AtCozyCornerNS

  constructor(client: XrpcClient) {
    this._client = client
    this.cozyCorner = new AtCozyCornerNS(client)
  }
}

export class AtCozyCornerNS {
  _client: XrpcClient
  avatar: AtCozyCornerAvatarRecord
  critter: AtCozyCornerCritterRecord
  house: AtCozyCornerHouseRecord
  inventory: AtCozyCornerInventoryRecord
  item: AtCozyCornerItemRecord
  settings: AtCozyCornerSettingsRecord
  starterPack: AtCozyCornerStarterPackRecord
  tileset: AtCozyCornerTilesetRecord
  avatar: AtCozyCornerAvatarNS
  house: AtCozyCornerHouseNS

  constructor(client: XrpcClient) {
    this._client = client
    this.avatar = new AtCozyCornerAvatarNS(client)
    this.house = new AtCozyCornerHouseNS(client)
    this.avatar = new AtCozyCornerAvatarRecord(client)
    this.critter = new AtCozyCornerCritterRecord(client)
    this.house = new AtCozyCornerHouseRecord(client)
    this.inventory = new AtCozyCornerInventoryRecord(client)
    this.item = new AtCozyCornerItemRecord(client)
    this.settings = new AtCozyCornerSettingsRecord(client)
    this.starterPack = new AtCozyCornerStarterPackRecord(client)
    this.tileset = new AtCozyCornerTilesetRecord(client)
  }
}

export class AtCozyCornerAvatarNS {
  _client: XrpcClient
  base: AtCozyCornerAvatarBaseRecord
  wearable: AtCozyCornerAvatarWearableRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.base = new AtCozyCornerAvatarBaseRecord(client)
    this.wearable = new AtCozyCornerAvatarWearableRecord(client)
  }
}

export class AtCozyCornerAvatarBaseRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerAvatarBase.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.avatar.base',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AtCozyCornerAvatarBase.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.avatar.base',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerAvatarBase.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.avatar.base'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerAvatarBase.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.avatar.base'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.avatar.base', ...params },
      { headers },
    )
  }
}

export class AtCozyCornerAvatarWearableRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerAvatarWearable.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.avatar.wearable',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AtCozyCornerAvatarWearable.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.avatar.wearable',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerAvatarWearable.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.avatar.wearable'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerAvatarWearable.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.avatar.wearable'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.avatar.wearable', ...params },
      { headers },
    )
  }
}

export class AtCozyCornerHouseNS {
  _client: XrpcClient
  room: AtCozyCornerHouseRoomRecord

  constructor(client: XrpcClient) {
    this._client = client
    this.room = new AtCozyCornerHouseRoomRecord(client)
  }

  updatePresence(
    data?: AtCozyCornerHouseUpdatePresence.InputSchema,
    opts?: AtCozyCornerHouseUpdatePresence.CallOptions,
  ): Promise<AtCozyCornerHouseUpdatePresence.Response> {
    return this._client.call(
      'at.cozy-corner.house.updatePresence',
      opts?.qp,
      data,
      opts,
    )
  }
}

export class AtCozyCornerHouseRoomRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerHouseRoom.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.house.room',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AtCozyCornerHouseRoom.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.house.room',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerHouseRoom.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.house.room'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerHouseRoom.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.house.room'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.house.room', ...params },
      { headers },
    )
  }
}

export class AtCozyCornerAvatarRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerAvatar.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.avatar',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AtCozyCornerAvatar.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.avatar',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerAvatar.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.avatar'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection,
        rkey: 'self',
        ...params,
        record: { ...record, $type: collection },
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerAvatar.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.avatar'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.avatar', ...params },
      { headers },
    )
  }
}

export class AtCozyCornerCritterRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerCritter.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.critter',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AtCozyCornerCritter.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.critter',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerCritter.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.critter'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerCritter.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.critter'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.critter', ...params },
      { headers },
    )
  }
}

export class AtCozyCornerHouseRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerHouse.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.house',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AtCozyCornerHouse.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.house',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerHouse.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.house'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection,
        rkey: 'self',
        ...params,
        record: { ...record, $type: collection },
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerHouse.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.house'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.house', ...params },
      { headers },
    )
  }
}

export class AtCozyCornerInventoryRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerInventory.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.inventory',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AtCozyCornerInventory.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.inventory',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerInventory.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.inventory'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerInventory.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.inventory'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.inventory', ...params },
      { headers },
    )
  }
}

export class AtCozyCornerItemRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerItem.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.item',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AtCozyCornerItem.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.item',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerItem.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.item'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerItem.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.item'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.item', ...params },
      { headers },
    )
  }
}

export class AtCozyCornerSettingsRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerSettings.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.settings',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AtCozyCornerSettings.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.settings',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerSettings.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.settings'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      {
        collection,
        rkey: 'self',
        ...params,
        record: { ...record, $type: collection },
      },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerSettings.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.settings'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.settings', ...params },
      { headers },
    )
  }
}

export class AtCozyCornerStarterPackRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerStarterPack.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.starterPack',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{
    uri: string
    cid: string
    value: AtCozyCornerStarterPack.Record
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.starterPack',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerStarterPack.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.starterPack'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerStarterPack.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.starterPack'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.starterPack', ...params },
      { headers },
    )
  }
}

export class AtCozyCornerTilesetRecord {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  async list(
    params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>,
  ): Promise<{
    cursor?: string
    records: { uri: string; value: AtCozyCornerTileset.Record }[]
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'at.cozy-corner.tileset',
      ...params,
    })
    return res.data
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>,
  ): Promise<{ uri: string; cid: string; value: AtCozyCornerTileset.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'at.cozy-corner.tileset',
      ...params,
    })
    return res.data
  }

  async create(
    params: OmitKey<
      ComAtprotoRepoCreateRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerTileset.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.tileset'
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async put(
    params: OmitKey<
      ComAtprotoRepoPutRecord.InputSchema,
      'collection' | 'record'
    >,
    record: Un$Typed<AtCozyCornerTileset.Record>,
    headers?: Record<string, string>,
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'at.cozy-corner.tileset'
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers },
    )
    return res.data
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>,
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'at.cozy-corner.tileset', ...params },
      { headers },
    )
  }
}
