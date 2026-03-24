/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from '@atproto/lexicon'
import { type $Typed, is$typed, maybe$typed } from './util.js'

export const schemaDict = {
  AtCozyCornerAvatar: {
    lexicon: 1,
    id: 'at.cozy-corner.avatar',
    defs: {
      main: {
        type: 'record',
        description:
          "A user's avatar. One per DID. The base body is a built-in greyscale walk sprite tinted by the tint color. Wearables composite on top in array order.",
        key: 'literal:self',
        record: {
          type: 'object',
          required: ['createdAt'],
          properties: {
            baseAvatar: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
              description: 'Strong reference to the base avatar record.',
            },
            baseAvatarTints: {
              type: 'array',
              description: 'Tints for the base avatar layers',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#channelTint',
              },
            },
            baseAvatarTransform: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#transform',
              description:
                'Optional 2D affine transform applied when compositing the base avatar, stored as a fixed-point matrix (see at.cozy-corner.defs#wearableTransform).',
            },
            wearables: {
              type: 'array',
              description:
                'Equipped wearables in composite order (first = bottom layer). Each entry references a wearable and can override tint/offset.',
              maxLength: 32,
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.avatar#equippedWearable',
              },
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      equippedWearable: {
        type: 'object',
        description:
          'A wearable equipped on an avatar, with per-equip overrides.',
        required: ['wearable'],
        properties: {
          wearable: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
            description: 'Strong reference to the wearable record.',
          },
          tints: {
            type: 'array',
            description: 'Tints for the wearable layers',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#channelTint',
            },
          },
          transform: {
            type: 'ref',
            ref: 'lex:at.cozy-corner.defs#transform',
            description:
              'Optional 2D affine transform applied when compositing this wearable, stored as a fixed-point matrix (see at.cozy-corner.defs#wearableTransform).',
          },
          state: {
            type: 'array',
            description:
              'State values for this equipped wearable, overriding stateProperty defaults.',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#stateValue',
            },
            maxLength: 32,
          },
        },
      },
    },
  },
  AtCozyCornerAvatarBase: {
    lexicon: 1,
    id: 'at.cozy-corner.avatar.base',
    defs: {
      main: {
        type: 'record',
        description:
          'A base avatar definition. Defines the character body with animated sprites for every direction and state combination.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'spriteSheet', 'layers', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              maxLength: 640,
              maxGraphemes: 64,
              description: 'Display name for the base avatar.',
            },
            description: {
              type: 'string',
              maxLength: 2560,
              maxGraphemes: 256,
              description: 'Free-form description of the base avatar.',
            },
            tags: {
              type: 'array',
              description: 'Tags for the base avatar.',
              items: {
                type: 'string',
                maxLength: 640,
                maxGraphemes: 64,
              },
              maxLength: 16,
            },
            spriteSheet: {
              type: 'blob',
              accept: ['image/png', 'image/webp'],
              maxSize: 5000000,
            },
            layers: {
              type: 'array',
              description:
                'Animation layers for the base avatar. A complete base avatar should provide layers for the well-known targets: walk (south/north/east/west), sit (south/north/east/west), hold (south/north/east/west), push (south/north/east/west), pickup (south/north/east/west), and dance. Stand pose reuses walk frame 1. Frame count and frame rate are per-layer. Authoring tools may generate east/west by mirroring.',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#animationLayer',
              },
            },
            behaviors: {
              type: 'array',
              description:
                'Lua scripts that define how this avatar base responds to events (e.g. setting animation state based on movement, intercepting move events).',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.script#script',
              },
              maxLength: 16,
            },
            stateProperties: {
              type: 'array',
              description:
                'Declares the configurable state properties for this base avatar. Behaviors read these via entityState.',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#stateProperty',
              },
              maxLength: 32,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AtCozyCornerAvatarWearable: {
    lexicon: 1,
    id: 'at.cozy-corner.avatar.wearable',
    defs: {
      main: {
        type: 'record',
        description:
          "A wearable overlay for avatars. Authored against a specific base avatar whose animation targets it must match. Can be created by any user and equipped by others. Compositing z-order is determined by position in the avatar's wearable list, not by the wearable itself.",
        key: 'tid',
        record: {
          type: 'object',
          required: [
            'name',
            'spriteSheet',
            'layers',
            'baseAvatar',
            'createdAt',
          ],
          properties: {
            name: {
              type: 'string',
              maxLength: 640,
              maxGraphemes: 64,
              description: 'Display name for the wearable.',
            },
            description: {
              type: 'string',
              maxLength: 2560,
              maxGraphemes: 256,
              description: 'Free-form description of the wearable.',
            },
            tags: {
              type: 'array',
              description: 'Tags for the wearable.',
              items: {
                type: 'string',
                maxLength: 640,
                maxGraphemes: 64,
              },
            },
            spriteSheet: {
              type: 'blob',
              accept: ['image/png', 'image/webp'],
              maxSize: 5000000,
            },
            layers: {
              type: 'array',
              description: 'layers of the wearable',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#animationLayer',
              },
            },
            behaviors: {
              type: 'array',
              description:
                'Lua scripts that define how this wearable responds to events (e.g. setting animation state based on movement, intercepting move events).',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.script#script',
              },
              maxLength: 16,
            },
            stateProperties: {
              type: 'array',
              description:
                'Declares the configurable state properties for this wearable. Behaviors read these via entityState.',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#stateProperty',
              },
              maxLength: 32,
            },
            baseAvatar: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
              description:
                "Strong reference to the base avatar record this wearable is authored against. The wearable's animation layers must match the base avatar's well-known targets.",
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AtCozyCornerBehavior: {
    lexicon: 1,
    id: 'at.cozy-corner.behavior',
    defs: {
      behavior: {
        type: 'object',
        required: ['on', 'emit'],
        properties: {
          name: {
            type: 'string',
            description: 'The name of the behavior',
          },
          on: {
            type: 'array',
            items: {
              type: 'string',
              description: 'The event to trigger the behavior',
            },
            minLength: 1,
          },
          queries: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:at.cozy-corner.behavior#bestTileQuery',
                'lex:at.cozy-corner.behavior#matchTileQuery',
                'lex:at.cozy-corner.behavior#nearestEntityQuery',
              ],
            },
          },
          when: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#andComparison',
              'lex:at.cozy-corner.behavior#orComparison',
              'lex:at.cozy-corner.behavior#notComparison',
              'lex:at.cozy-corner.behavior#chanceComparison',
              'lex:at.cozy-corner.behavior#existsComparison',
              'lex:at.cozy-corner.behavior#greaterThanComparison',
              'lex:at.cozy-corner.behavior#lessThanComparison',
              'lex:at.cozy-corner.behavior#equalToComparison',
            ],
          },
          consumed: {
            type: 'boolean',
            description:
              "If true (default), the event is consumed when this behavior's condition passes — no further behaviors on this entity handle it, and the event does not propagate to children. Set to false to allow other behaviors and children to also handle the event.",
            default: true,
          },
          emit: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.behavior#event',
            },
            minLength: 1,
          },
        },
      },
      bestTileQuery: {
        type: 'object',
        required: ['type', 'name', 'range', 'attributes'],
        description:
          'A query for the best tile matching a weighted set of attributes',
        properties: {
          type: {
            type: 'string',
            const: 'bestTile',
          },
          name: {
            type: 'string',
            description: 'The name of the query',
          },
          range: {
            type: 'integer',
            description: 'The radius of the query',
            minimum: 1,
            maximum: 64,
          },
          direction: {
            type: 'integer',
            description:
              'The direction of the query, bitmask, 1 = south, 2 = north, 4 = east, 8 = west',
            minimum: 0,
            maximum: 15,
            default: 15,
          },
          attributes: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.behavior#queryAttribute',
            },
            minLength: 1,
          },
        },
      },
      matchTileQuery: {
        type: 'object',
        required: ['type', 'name', 'range', 'attributes'],
        description:
          'A query for the nearest tile where all attributes satisfy their comparison conditions',
        properties: {
          type: {
            type: 'string',
            const: 'matchTile',
          },
          name: {
            type: 'string',
            description: 'The name of the query',
          },
          range: {
            type: 'integer',
            description: 'The radius of the query',
            minimum: 1,
            maximum: 64,
          },
          direction: {
            type: 'integer',
            description:
              'The direction of the query, bitmask, 1 = south, 2 = north, 4 = east, 8 = west',
            minimum: 0,
            maximum: 15,
            default: 15,
          },
          attributes: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.behavior#matchAttribute',
            },
            minLength: 1,
          },
        },
      },
      nearestEntityQuery: {
        type: 'object',
        required: ['type', 'name', 'range'],
        description:
          'Find the nearest sibling entity whose behavior state matches all specified conditions. Returns x, y, distance in the query result. Excludes the querying entity itself.',
        properties: {
          type: {
            type: 'string',
            const: 'nearestEntity',
          },
          name: {
            type: 'string',
            description: 'The name of the query result',
          },
          range: {
            type: 'integer',
            description: 'Maximum Manhattan distance to search',
            minimum: 1,
            maximum: 64,
          },
          direction: {
            type: 'integer',
            description:
              'Direction bitmask filter, 1 = south, 2 = north, 4 = east, 8 = west',
            minimum: 0,
            maximum: 15,
            default: 15,
          },
          match: {
            type: 'array',
            description:
              "State conditions that must all match on the target entity's behavior state",
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.behavior#entityMatch',
            },
          },
        },
      },
      entityMatch: {
        type: 'object',
        description:
          "A condition on an entity's behavior state. If value is omitted, checks existence. If comparison is omitted, defaults to equality.",
        required: ['state'],
        properties: {
          state: {
            type: 'string',
            description: 'The behavior state key to check',
          },
          comparison: {
            type: 'string',
            description:
              "The comparison operation. Defaults to 'eq' when omitted.",
            enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
          },
          value: {
            type: 'union',
            description:
              'The expected value. If omitted, checks that the state key exists.',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#stringValue',
            ],
          },
        },
      },
      queryAttribute: {
        type: 'object',
        properties: {
          attribute: {
            type: 'string',
            description: 'The name of the attribute to query',
          },
          value: {
            type: 'integer',
            description:
              'The value of the attribute to query, -100 to 100 shifted to 0 to 200',
            minimum: 0,
            maximum: 200,
          },
        },
      },
      matchAttribute: {
        type: 'object',
        required: ['attribute', 'comparison', 'value'],
        properties: {
          attribute: {
            type: 'string',
            description: 'The name of the attribute to match',
          },
          comparison: {
            type: 'string',
            description: 'The comparison operation',
            enum: ['gte', 'lte', 'gt', 'lt', 'eq', 'neq'],
          },
          value: {
            type: 'integer',
            description: 'The value to compare against',
            minimum: 0,
            maximum: 100,
          },
        },
      },
      andComparison: {
        type: 'object',
        description:
          'A comparison of two or more attributes using the AND operator',
        required: ['and'],
        properties: {
          and: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:at.cozy-corner.behavior#andComparison',
                'lex:at.cozy-corner.behavior#orComparison',
                'lex:at.cozy-corner.behavior#notComparison',
                'lex:at.cozy-corner.behavior#chanceComparison',
                'lex:at.cozy-corner.behavior#greaterThanComparison',
                'lex:at.cozy-corner.behavior#lessThanComparison',
                'lex:at.cozy-corner.behavior#equalToComparison',
              ],
            },
            minLength: 1,
          },
        },
      },
      orComparison: {
        type: 'object',
        description:
          'A comparison of two or more attributes using the OR operator',
        required: ['or'],
        properties: {
          or: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:at.cozy-corner.behavior#andComparison',
                'lex:at.cozy-corner.behavior#orComparison',
                'lex:at.cozy-corner.behavior#notComparison',
                'lex:at.cozy-corner.behavior#chanceComparison',
                'lex:at.cozy-corner.behavior#greaterThanComparison',
                'lex:at.cozy-corner.behavior#lessThanComparison',
                'lex:at.cozy-corner.behavior#equalToComparison',
              ],
            },
            minLength: 1,
          },
        },
      },
      notComparison: {
        type: 'object',
        description: 'A negation of a comparison',
        required: ['not'],
        properties: {
          not: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#andComparison',
              'lex:at.cozy-corner.behavior#orComparison',
              'lex:at.cozy-corner.behavior#notComparison',
              'lex:at.cozy-corner.behavior#greaterThanComparison',
              'lex:at.cozy-corner.behavior#lessThanComparison',
              'lex:at.cozy-corner.behavior#equalToComparison',
            ],
          },
        },
      },
      chanceComparison: {
        type: 'object',
        description:
          'Evaluates to true with the given probability. Used for stochastic timing (e.g. random cooldowns on tick events).',
        required: ['chance'],
        properties: {
          chance: {
            type: 'integer',
            description:
              'Probability per evaluation, from 0 (never) to 10000 (always). For tick-based cooldowns at ~60fps: 167 ≈ 1s mean wait, 30 ≈ 5.5s, 17 ≈ 10s.',
            minimum: 0,
            maximum: 10000,
          },
        },
      },
      existsComparison: {
        type: 'object',
        required: ['exists'],
        properties: {
          exists: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#eventValue',
            ],
          },
        },
      },
      greaterThanComparison: {
        type: 'object',
        required: ['compare', 'greaterThan'],
        properties: {
          compare: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#attributeAt',
              'lex:at.cozy-corner.behavior#timeSince',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
          greaterThan: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#attributeAt',
              'lex:at.cozy-corner.behavior#timeSince',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
        },
      },
      lessThanComparison: {
        type: 'object',
        required: ['compare', 'lessThan'],
        properties: {
          compare: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#attributeAt',
              'lex:at.cozy-corner.behavior#timeSince',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
          lessThan: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#attributeAt',
              'lex:at.cozy-corner.behavior#timeSince',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
        },
      },
      equalToComparison: {
        type: 'object',
        required: ['compare', 'equalTo'],
        properties: {
          compare: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#stringValue',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#attributeAt',
              'lex:at.cozy-corner.behavior#timeSince',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
          equalTo: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#stringValue',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#attributeAt',
              'lex:at.cozy-corner.behavior#timeSince',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
        },
      },
      value: {
        type: 'object',
        required: ['value'],
        properties: {
          value: {
            type: 'integer',
            description: 'The value to compare to',
          },
        },
      },
      stringValue: {
        type: 'object',
        required: ['stringValue'],
        properties: {
          stringValue: {
            type: 'string',
            description: 'The string value to compare to',
          },
        },
      },
      eventValue: {
        type: 'object',
        required: ['property'],
        properties: {
          property: {
            type: 'string',
            description: 'The name of the property',
          },
        },
      },
      queryResult: {
        type: 'object',
        required: ['queryName', 'property'],
        properties: {
          queryName: {
            type: 'string',
            description: 'The name of the query',
          },
          property: {
            type: 'string',
            description: 'The property of the query result to compare to',
          },
        },
      },
      entityState: {
        type: 'object',
        required: ['entity', 'state'],
        properties: {
          entity: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#entityTarget',
              'lex:at.cozy-corner.behavior#entityAt',
              'lex:at.cozy-corner.behavior#entityId',
              'lex:at.cozy-corner.behavior#entityParent',
            ],
          },
          state: {
            type: 'string',
            description: 'The state key for the entity',
          },
        },
      },
      entityTarget: {
        type: 'object',
        required: ['target'],
        properties: {
          target: {
            type: 'string',
            enum: ['self', 'target'],
          },
        },
      },
      entityAt: {
        type: 'object',
        description:
          'Reference an entity at a specific grid position (for reading state only, not as an emit target).',
        required: ['atX', 'atY'],
        properties: {
          atX: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
          atY: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
        },
      },
      entityId: {
        type: 'object',
        description:
          'Reference an entity by its behavior:id state value (for reading state only, not as an emit target).',
        required: ['id'],
        properties: {
          id: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#stringValue',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
            ],
          },
        },
      },
      attributeAt: {
        type: 'object',
        required: ['attribute', 'atX', 'atY'],
        properties: {
          attribute: {
            type: 'string',
            description: 'The name of the attribute to read',
          },
          atX: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
          atY: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
        },
      },
      timeSince: {
        type: 'object',
        description:
          'Computes elapsed milliseconds since a stored timestamp: (current event time − timestamp). The timestamp source must resolve to a numeric value (e.g. from entityState set via setState).',
        required: ['timestamp'],
        properties: {
          timestamp: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
            ],
          },
        },
      },
      addValue: {
        type: 'object',
        description: 'Numeric addition: resolves to add[0] + add[1].',
        required: ['add'],
        properties: {
          add: {
            type: 'array',
            minLength: 2,
            maxLength: 2,
            items: {
              type: 'union',
              refs: [
                'lex:at.cozy-corner.behavior#value',
                'lex:at.cozy-corner.behavior#eventValue',
                'lex:at.cozy-corner.behavior#queryResult',
                'lex:at.cozy-corner.behavior#entityState',
                'lex:at.cozy-corner.behavior#attributeAt',
                'lex:at.cozy-corner.behavior#timeSince',
                'lex:at.cozy-corner.behavior#addValue',
                'lex:at.cozy-corner.behavior#subtractValue',
              ],
            },
          },
        },
      },
      subtractValue: {
        type: 'object',
        description:
          'Numeric subtraction: resolves to subtract[0] − subtract[1].',
        required: ['subtract'],
        properties: {
          subtract: {
            type: 'array',
            minLength: 2,
            maxLength: 2,
            items: {
              type: 'union',
              refs: [
                'lex:at.cozy-corner.behavior#value',
                'lex:at.cozy-corner.behavior#eventValue',
                'lex:at.cozy-corner.behavior#queryResult',
                'lex:at.cozy-corner.behavior#entityState',
                'lex:at.cozy-corner.behavior#attributeAt',
                'lex:at.cozy-corner.behavior#timeSince',
                'lex:at.cozy-corner.behavior#addValue',
                'lex:at.cozy-corner.behavior#subtractValue',
              ],
            },
          },
        },
      },
      entityParent: {
        type: 'object',
        description: 'References the parent entity in the entity tree.',
        properties: {
          kind: {
            type: 'string',
            const: 'parent',
          },
        },
      },
      entityChildren: {
        type: 'object',
        description:
          'References all children of the entity. Only valid as an emit target — the event is broadcast to each child.',
        properties: {
          kind: {
            type: 'string',
            const: 'children',
          },
        },
      },
      event: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            knownValues: ['moveTo', 'setState', 'target'],
          },
          target: {
            type: 'union',
            description:
              'Entity to emit the event on. Defaults to self if omitted.',
            refs: [
              'lex:at.cozy-corner.behavior#entityTarget',
              'lex:at.cozy-corner.behavior#entityParent',
              'lex:at.cozy-corner.behavior#entityChildren',
            ],
          },
          properties: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.behavior#eventProperty',
            },
          },
        },
      },
      eventProperty: {
        type: 'object',
        required: ['name', 'value'],
        properties: {
          name: {
            type: 'string',
            description: 'The name of the property',
          },
          value: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.behavior#value',
              'lex:at.cozy-corner.behavior#stringValue',
              'lex:at.cozy-corner.behavior#eventValue',
              'lex:at.cozy-corner.behavior#queryResult',
              'lex:at.cozy-corner.behavior#entityState',
              'lex:at.cozy-corner.behavior#attributeAt',
              'lex:at.cozy-corner.behavior#timeSince',
              'lex:at.cozy-corner.behavior#addValue',
              'lex:at.cozy-corner.behavior#subtractValue',
            ],
          },
        },
      },
    },
  },
  AtCozyCornerCritter: {
    lexicon: 1,
    id: 'at.cozy-corner.critter',
    defs: {
      main: {
        type: 'record',
        description:
          'A critter definition — an autonomous creature that roams rooms. Critters have directional stateful animations (like avatars) and declarative behaviors that control movement, reactions, and timing via the behavior model.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'spriteSheet', 'layers', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              maxLength: 640,
              maxGraphemes: 64,
              description:
                'Display name for this critter type (e.g. Tabby Cat, Goldfish).',
            },
            description: {
              type: 'string',
              maxLength: 2560,
              maxGraphemes: 256,
              description: 'Free-form description of the critter.',
            },
            tags: {
              type: 'array',
              description: 'Tags for the critter.',
              items: {
                type: 'string',
                maxLength: 640,
                maxGraphemes: 64,
              },
              maxLength: 16,
            },
            spriteSheet: {
              type: 'blob',
              accept: ['image/png', 'image/webp'],
              maxSize: 5000000,
            },
            layers: {
              type: 'array',
              description: 'layers of the critter',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#animationLayer',
              },
            },
            behaviors: {
              type: 'array',
              description:
                'Lua scripts that define how this critter responds to events (e.g. seeking tiles on a timer, reacting to nearby entities).',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.script#script',
              },
              maxLength: 16,
            },
            stateProperties: {
              type: 'array',
              description:
                'Declares the configurable state properties for this critter. Behaviors read these via entityState; placements can override values.',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#stateProperty',
              },
              maxLength: 32,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AtCozyCornerDefs: {
    lexicon: 1,
    id: 'at.cozy-corner.defs',
    defs: {
      animationFrame: {
        type: 'object',
        description: 'A single frame within an animation layer',
        required: ['x', 'y', 'width', 'height'],
        properties: {
          x: {
            type: 'integer',
            description: 'Source X in sprite sheet',
          },
          y: {
            type: 'integer',
            description: 'Source Y in sprite sheet',
          },
          width: {
            type: 'integer',
            description: 'Source width in sprite sheet',
          },
          height: {
            type: 'integer',
            description: 'Source height in sprite sheet',
          },
        },
      },
      animationLayer: {
        type: 'object',
        description: 'A layer of sprite animations',
        required: ['target', 'frames'],
        properties: {
          target: {
            type: 'string',
            description:
              'Animation state identifier. For base avatars and wearables, use the well-known directional targets: walk-south, walk-north, walk-east, walk-west, sit-south, sit-north, sit-east, sit-west, hold-south, hold-north, hold-east, hold-west, push-south, push-north, push-east, push-west, pickup-south, pickup-north, pickup-east, pickup-west, and dance. Frame count and frame rate are defined per layer — authors choose their own animation detail level. For items, this is the variant name.',
            knownValues: [
              'walk-south',
              'walk-north',
              'walk-east',
              'walk-west',
              'sit-south',
              'sit-north',
              'sit-east',
              'sit-west',
              'hold-south',
              'hold-north',
              'hold-east',
              'hold-west',
              'push-south',
              'push-north',
              'push-east',
              'push-west',
              'pickup-south',
              'pickup-north',
              'pickup-east',
              'pickup-west',
              'dance',
            ],
          },
          layerName: {
            type: 'string',
            description: 'The display name of the layer',
          },
          frames: {
            type: 'array',
            description: 'The frames of the animation',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#animationFrame',
            },
          },
          frameRate: {
            type: 'integer',
            description: 'The frame rate in milliseconds per frame',
            default: 24,
          },
          zIndex: {
            type: 'integer',
            description:
              'Draw order relative to the entity. 0 = behind (default), 1 = in front. For furniture this allows parts like armrests to draw over the avatar.',
            default: 0,
            minimum: 0,
            maximum: 1,
          },
          colorChannel: {
            type: 'string',
            description:
              'Optional color channel name for tint customization. Layers sharing the same channel name are tinted together. When present, the user can customize the tint color for this channel. When omitted, the layer is not user-customizable.',
            maxLength: 640,
            maxGraphemes: 64,
          },
        },
      },
      channelTint: {
        type: 'object',
        description:
          'A tint for a color channel. All animation layers sharing the same colorChannel name are tinted together.',
        required: ['channel', 'tint'],
        properties: {
          channel: {
            type: 'string',
            description:
              'The color channel name. Must match a colorChannel value on one or more animation layers.',
            maxLength: 640,
            maxGraphemes: 64,
          },
          tint: {
            type: 'string',
            description:
              "Hex color to tint the channel (e.g. '#cc4444'). Must be a '#' followed by 3 or 6 hex digits.",
            maxLength: 7,
          },
        },
      },
      transform: {
        type: 'object',
        description:
          '2D affine transform for wearables and other sprite-like entities. Components map directly to a CanvasRenderingContext2D-style transform(a, b, c, d, e, f). Values are stored as fixed-point integers where 1000 = 1.0 (e.g. 1500 = 1.5, -500 = -0.5). If omitted, the identity transform is used.',
        properties: {
          a: {
            type: 'integer',
            description:
              'Scale X / cos/skew component, fixed-point where 1000 = 1.0. Default 1000.',
            default: 1000,
          },
          b: {
            type: 'integer',
            description:
              'Skew Y component, fixed-point where 1000 = 1.0. Default 0.',
            default: 0,
          },
          c: {
            type: 'integer',
            description:
              'Skew X component, fixed-point where 1000 = 1.0. Default 0.',
            default: 0,
          },
          d: {
            type: 'integer',
            description:
              'Scale Y component, fixed-point where 1000 = 1.0. Default 1000.',
            default: 1000,
          },
          e: {
            type: 'integer',
            description:
              'Translate X in avatar or world coordinate units, fixed-point where 1000 = 1.0 unit. Default 0.',
            default: 0,
          },
          f: {
            type: 'integer',
            description:
              'Translate Y in avatar or world coordinate units, fixed-point where 1000 = 1.0 unit. Default 0.',
            default: 0,
          },
        },
      },
      movementAttribute: {
        type: 'object',
        description:
          'A named attribute with a value from 0–200 representing –100 to +100 (shifted positive). Used on critters and items to express attraction/repulsion to tile-emitted signals.',
        required: ['attribute', 'value'],
        properties: {
          attribute: {
            type: 'string',
            description: 'The attribute name.',
            maxLength: 640,
            maxGraphemes: 64,
            knownValues: [
              'light',
              'heat',
              'food',
              'water',
              'comfort',
              'noise',
              'people',
            ],
          },
          value: {
            type: 'integer',
            description:
              'Attribute strength. 0 = –100 (strong repulsion/absence), 100 = neutral, 200 = +100 (strong attraction/presence).',
            minimum: 0,
            maximum: 200,
          },
        },
      },
      stateProperty: {
        type: 'object',
        description:
          'Declares a named, typed state property on an entity. Behaviors read these values via entityState at runtime.',
        required: ['name', 'type'],
        properties: {
          name: {
            type: 'string',
            description: 'Property name used as the state key.',
            maxLength: 64,
          },
          type: {
            type: 'string',
            description:
              'Value type. Controls editor widget and serialisation.',
            knownValues: [
              'string',
              'integer',
              'blob',
              'direction',
              'edges',
              'attribute',
            ],
          },
          default: {
            type: 'string',
            description:
              'Default value (as a string). Omit for blob properties.',
          },
          allowOverride: {
            type: 'boolean',
            description:
              'When true, this property can be overridden on placement (room item) or equip (avatar wearable). Defaults to false.',
            default: false,
          },
        },
      },
      stateValue: {
        type: 'object',
        description:
          'A concrete value for a declared state property. Provide either value (for non-blob types) or blob (for blob type).',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Must match a stateProperty name on the entity.',
            maxLength: 64,
          },
          value: {
            type: 'string',
            description: 'String-serialised value for non-blob properties.',
          },
          blob: {
            type: 'blob',
            description: 'Blob value for blob-typed properties.',
            accept: [
              'image/png',
              'image/webp',
              'image/jpeg',
              'video/mp4',
              'audio/mpeg',
              'audio/ogg',
              'audio/wav',
            ],
            maxSize: 5000000,
          },
        },
      },
      categorizedEntry: {
        type: 'object',
        description: 'An entry in a category.',
        required: ['item', 'category'],
        properties: {
          item: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
            description: 'Strong reference to the item record.',
          },
          category: {
            type: 'string',
            description: 'The category of the entry.',
            knownValues: [
              'item',
              'wearable',
              'tileset',
              'baseAvatar',
              'critter',
            ],
          },
        },
      },
    },
  },
  AtCozyCornerHouse: {
    lexicon: 1,
    id: 'at.cozy-corner.house',
    defs: {
      main: {
        type: 'record',
        description: "A user's cozy house. One per DID.",
        key: 'literal:self',
        record: {
          type: 'object',
          required: ['entry', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              maxLength: 640,
              maxGraphemes: 64,
              description: 'Display name for the house.',
            },
            splash: {
              type: 'blob',
              description: 'Splash image shown while the house is loading.',
              accept: ['image/png', 'image/webp', 'image/jpeg'],
              maxSize: 1000000,
            },
            entry: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
              description:
                "Strong reference to the entry room record (at.cozy-corner.house.room). Visitors spawn in this room's spawn area.",
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AtCozyCornerHouseDefs: {
    lexicon: 1,
    id: 'at.cozy-corner.house.defs',
    defs: {
      did: {
        type: 'object',
        required: ['type', 'did'],
        properties: {
          type: {
            type: 'string',
            const: 'did',
          },
          did: {
            type: 'string',
            format: 'did',
            description: 'DID of the user.',
          },
        },
      },
      anonymousId: {
        type: 'object',
        required: ['type', 'anonymousId'],
        properties: {
          type: {
            type: 'string',
            const: 'anonymousId',
          },
          anonymousId: {
            type: 'string',
            description: 'Anonymous ID of the user.',
          },
        },
      },
    },
  },
  AtCozyCornerHousePresence: {
    lexicon: 1,
    id: 'at.cozy-corner.house.presence',
    defs: {
      main: {
        type: 'subscription',
        description:
          'Subscribe to real-time presence events in a room. Opens a WebSocket connection that streams tick snapshots containing authoritative entity state. The server runs a fixed-rate tick loop and broadcasts full entity state each tick when changed.',
        parameters: {
          type: 'params',
          required: ['room', 'cid'],
          properties: {
            room: {
              type: 'string',
              format: 'at-uri',
              description: 'AT URI of the room to join.',
            },
            cid: {
              type: 'string',
              format: 'cid',
              description: 'CID of the room record version.',
            },
          },
        },
        message: {
          description: 'Server-to-client event stream.',
          schema: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.house.presence#tickSnapshot',
              'lex:at.cozy-corner.house.presence#leave',
            ],
          },
        },
      },
      entityState: {
        type: 'object',
        description:
          'Authoritative state of an entity in the room, with fields for movement interpolation.',
        required: ['id', 'x', 'y', 'direction', 'animState'],
        properties: {
          id: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.house.defs#did',
              'lex:at.cozy-corner.house.defs#anonymousId',
            ],
          },
          handle: {
            type: 'string',
            description: "The user's handle. Empty string for anonymous users.",
          },
          x: {
            type: 'integer',
            description: 'Current tile x position.',
          },
          y: {
            type: 'integer',
            description: 'Current tile y position.',
          },
          direction: {
            type: 'integer',
            description: 'Direction: 0=south, 1=west, 2=north, 3=east.',
            minimum: 0,
            maximum: 3,
          },
          animState: {
            type: 'string',
            description: 'Animation state (idle, walk, sit).',
            knownValues: ['idle', 'walk', 'sit'],
          },
          moveTargetX: {
            type: 'integer',
            description: 'Target tile x of current move step (if walking).',
          },
          moveTargetY: {
            type: 'integer',
            description: 'Target tile y of current move step (if walking).',
          },
          moveStartTick: {
            type: 'integer',
            description: 'Tick when the current move step started.',
          },
          moveSpeed: {
            type: 'integer',
            description: 'Move speed in ms per tile.',
          },
          target: {
            type: 'string',
            description:
              'Current animation target (e.g. idle-south, walk-north).',
          },
          targetStartTick: {
            type: 'integer',
            description: 'Tick when the current animation target started.',
          },
          speechText: {
            type: 'string',
            description: 'Text/emoji in the speech bubble.',
            maxLength: 32,
          },
          speechBubble: {
            type: 'string',
            description: 'Bubble style.',
            enum: ['thought', 'speech'],
          },
          speechStartTick: {
            type: 'integer',
            description: 'Tick when the speech bubble appeared.',
          },
          speechDuration: {
            type: 'integer',
            description: 'Duration in ms to show the speech bubble.',
          },
        },
      },
      tickSnapshot: {
        type: 'object',
        description:
          'Full authoritative state snapshot of all entities in the room. Sent each tick when state changes.',
        required: ['type', 'tick', 'entities'],
        properties: {
          type: {
            type: 'string',
            const: 'tickSnapshot',
          },
          tick: {
            type: 'integer',
            description: 'Server tick number for this snapshot.',
          },
          entities: {
            type: 'array',
            description: 'All entities currently in this room instance.',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.house.presence#entityState',
            },
          },
        },
      },
      leave: {
        type: 'object',
        description:
          'A user left the room (immediate notification before next snapshot).',
        required: ['type', 'id'],
        properties: {
          type: {
            type: 'string',
            const: 'leave',
          },
          id: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.house.defs#did',
              'lex:at.cozy-corner.house.defs#anonymousId',
            ],
          },
        },
      },
    },
  },
  AtCozyCornerHouseRoom: {
    lexicon: 1,
    id: 'at.cozy-corner.house.room',
    defs: {
      main: {
        type: 'record',
        description:
          'A room within a house. Rooms reference tilesets, items, and critters for a users inventory',
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'tileset', 'tiles', 'width', 'createdAt'],
          properties: {
            width: {
              type: 'integer',
              description:
                'Grid width of the room in tiles. All flat grid arrays (spawnTiles, blockingEdges, tileAttributes values) use this as their row stride.',
              minimum: 1,
              maximum: 64,
            },
            name: {
              type: 'string',
              maxLength: 640,
              maxGraphemes: 64,
              description: 'Display name for the room (e.g. Kitchen, Bedroom).',
            },
            tileset: {
              description: 'AT URI of the at.cozy-corner.tileset record.',
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            tiles: {
              type: 'array',
              description: 'Tiles positioned in the room',
              minLength: 1,
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.house.room#tilePosition',
              },
            },
            blockingEdges: {
              type: 'array',
              description:
                'Per-tile edge blocking as a flat array of width * height (row-major). Each value is a bitmask: bits 0-3 = physical blocking per direction (N=1, E=2, S=4, W=8), bits 4-7 = ephemeral blocking per direction (N=16, E=32, S=64, W=128). Physical blocks movement; ephemeral blocks light/sound/heat. A fully blocked tile has value 15 (physical) or 255 (both). 0 = no blocking.',
              items: {
                type: 'integer',
                minimum: 0,
                maximum: 255,
              },
              maxLength: 4096,
            },
            background: {
              type: 'union',
              description:
                'Background rendered behind the tile grid. Can be a solid color, gradient, or image.',
              refs: [
                'lex:at.cozy-corner.house.room#backgroundImage',
                'lex:at.cozy-corner.house.room#backgroundColor',
                'lex:at.cozy-corner.house.room#backgroundGradient',
              ],
            },
            spawnTiles: {
              type: 'array',
              description:
                'Per-tile spawn mask as a flat array of width * height (row-major). 1 = valid spawn tile, 0 = not spawnable. Players entering this room from outside appear at a random valid tile. If omitted or empty, players spawn at (0, 0).',
              items: {
                type: 'integer',
                minimum: 0,
                maximum: 1,
              },
              maxLength: 4096,
            },
            exits: {
              type: 'array',
              description: 'Connections to other rooms.',
              maxLength: 16,
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.house.room#exit',
              },
            },
            items: {
              type: 'array',
              description: 'Items placed in the room',
              maxLength: 64,
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.house.room#roomItem',
              },
            },
            critters: {
              type: 'array',
              description:
                'Critters placed in the room. Each entry spawns an autonomous creature at the given position.',
              maxLength: 16,
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.house.room#roomCritter',
              },
            },
            tileAttributes: {
              type: 'array',
              description:
                'Per-tile attribute scores (e.g. lighting, heat). Each entry defines one attribute with a flat width*height value array (row-major).',
              maxLength: 8,
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.house.room#tileAttribute',
              },
            },
            behaviors: {
              type: 'array',
              description:
                'Lua scripts that define how this room responds to events (e.g. cutscenes on enter, ambient effects).',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.script#script',
              },
              maxLength: 16,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      tileAttribute: {
        type: 'object',
        description:
          'A per-tile attribute score array. Values use the same 0-200 scale as movementAttribute (100 = neutral).',
        required: ['attribute', 'values'],
        properties: {
          attribute: {
            type: 'string',
            description: "Attribute name (e.g. 'light', 'heat', 'sound').",
            maxLength: 64,
          },
          values: {
            type: 'array',
            description:
              'Flat array of width * height values (row-major). Each value is 0-200 where 100 is neutral.',
            items: {
              type: 'integer',
              minimum: 0,
              maximum: 200,
            },
            maxLength: 4096,
          },
        },
      },
      tilePosition: {
        type: 'object',
        description: 'A tile position within a room',
        required: ['tile', 'x', 'y'],
        properties: {
          layerName: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
            description:
              'Display name for the layer (e.g. Floor, Walls, Canopy).',
          },
          tile: {
            type: 'integer',
            description: 'The tile index in the tileset',
            minimum: 0,
            maximum: 255,
          },
          x: {
            type: 'integer',
            description: 'The x position of the tile in the room',
            minimum: 0,
            maximum: 63,
          },
          y: {
            type: 'integer',
            description: 'The y position of the tile in the room',
            minimum: 0,
            maximum: 63,
          },
          tints: {
            type: 'array',
            description: 'Tints for the tile',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#channelTint',
            },
          },
          transform: {
            type: 'integer',
            description:
              'Packed tile transform. Bits 0-1: rotation (0=0°, 1=90°, 2=180°, 3=270°). Bit 2: horizontal mirror. Bit 3: vertical mirror.',
            minimum: 0,
            maximum: 15,
          },
          renderLayer: {
            type: 'integer',
            minimum: 0,
            maximum: 2,
            description:
              'The layer to render the tile on, 0 = background, 1 = foreground, 2 = overhead',
          },
        },
      },
      roomItem: {
        type: 'object',
        description: 'A an item placed in the room',
        required: ['item', 'x', 'y'],
        properties: {
          item: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
            description: 'Strong reference to the at.cozy-corner.item record.',
          },
          variant: {
            type: 'integer',
            description: 'The variant of the item to use',
            minimum: 0,
            maximum: 15,
          },
          x: {
            type: 'integer',
            description: 'The x position of the item in the room',
            minimum: 0,
            maximum: 63,
          },
          y: {
            type: 'integer',
            description: 'The y position of the item in the room',
            minimum: 0,
            maximum: 63,
          },
          tints: {
            type: 'array',
            description: 'Tints for the item layers',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#channelTint',
            },
          },
          transform: {
            type: 'ref',
            ref: 'lex:at.cozy-corner.defs#transform',
            description:
              'Optional 2D affine transform applied when compositing the item, stored as a fixed-point matrix (see at.cozy-corner.defs#transform).',
          },
          state: {
            type: 'array',
            description:
              'State values for this placement, overriding variant and stateProperty defaults.',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#stateValue',
            },
            maxLength: 32,
          },
          foreground: {
            type: 'integer',
            description:
              '1 if the item is painted on the front layer, 0 if it is painted behind',
            minimum: 0,
            maximum: 1,
          },
        },
      },
      backgroundImage: {
        type: 'object',
        description:
          'A background image rendered behind the tile grid (e.g. sky, landscape for outdoor rooms).',
        required: ['image'],
        properties: {
          image: {
            type: 'blob',
            description: 'The background image.',
            accept: ['image/png', 'image/webp', 'image/jpeg'],
            maxSize: 2000000,
          },
        },
      },
      backgroundColor: {
        type: 'object',
        description: 'A solid color background rendered behind the tile grid.',
        required: ['color'],
        properties: {
          color: {
            type: 'string',
            description: 'Hex color value (e.g. #1a1a2e, #87ceeb).',
            maxLength: 7,
            minLength: 7,
          },
        },
      },
      backgroundGradient: {
        type: 'object',
        description: 'A gradient background rendered behind the tile grid.',
        required: ['stops'],
        properties: {
          angle: {
            type: 'integer',
            description:
              'Gradient angle in degrees. 0 = top to bottom, 90 = left to right, 180 = bottom to top.',
            minimum: 0,
            maximum: 359,
            default: 0,
          },
          stops: {
            type: 'array',
            description: 'Gradient color stops. Must have at least 2.',
            maxLength: 8,
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.house.room#gradientStop',
            },
          },
        },
      },
      gradientStop: {
        type: 'object',
        description: 'A color stop in a gradient.',
        required: ['color'],
        properties: {
          color: {
            type: 'string',
            description: 'Hex color value (e.g. #1a1a2e).',
            maxLength: 7,
            minLength: 7,
          },
          position: {
            type: 'integer',
            description:
              'Position along the gradient as a percentage (0-100). If omitted, stops are evenly distributed.',
            minimum: 0,
            maximum: 100,
          },
        },
      },
      exit: {
        type: 'object',
        description:
          'A doorway or passage connecting this room to another. The exit occupies a rectangular region of tiles. To traverse a room exit the player must walk in the given direction while standing on an exit tile, or click the exit tile a second time.',
        required: ['x', 'y'],
        properties: {
          label: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
            description: 'Display label for the exit (e.g. Upstairs, Kitchen).',
          },
          target: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
            description:
              'Strong reference to the target at.cozy-corner.house.room. The CID pins the version of the room when this exit was last saved.',
          },
          targetExit: {
            type: 'integer',
            description:
              "Index into the target room's exits array identifying where the player should spawn. Only trusted when the target room's current CID matches the strong ref CID; otherwise falls back to reciprocal exit matching.",
            minimum: 0,
            maximum: 15,
          },
          x: {
            type: 'integer',
            description: 'Tile x position of this exit in the room.',
            minimum: 0,
          },
          y: {
            type: 'integer',
            description: 'Tile y position of this exit in the room.',
            minimum: 0,
          },
          width: {
            type: 'integer',
            description: 'Width of the exit region in tiles. Defaults to 1.',
            minimum: 1,
            maximum: 8,
            default: 1,
          },
          height: {
            type: 'integer',
            description: 'Height of the exit region in tiles. Defaults to 1.',
            minimum: 1,
            maximum: 8,
            default: 1,
          },
          direction: {
            type: 'integer',
            description:
              'A bitmask of the direction the player must walk to traverse the exit. N=1, E=2, S=4, W=8',
            minimum: 1,
            maximum: 15,
            default: 15,
          },
        },
      },
      roomCritter: {
        type: 'object',
        description:
          'A critter placed in the room. The area mask defines which tiles the critter can occupy (room.width * room.height, row-major, 1 = valid). The critter spawns at a random valid tile and roams within the area.',
        required: ['critter', 'area'],
        properties: {
          critter: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
            description:
              'Strong reference to the at.cozy-corner.critter record.',
          },
          area: {
            type: 'array',
            description:
              'Flat boolean mask of length room.width * room.height (row-major). 1 = tile the critter can occupy, 0 = off-limits. The critter spawns randomly on a valid tile.',
            items: {
              type: 'integer',
              minimum: 0,
              maximum: 1,
            },
            maxLength: 4096,
          },
          name: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
            description:
              'Override display name for this critter instance (e.g. Mr. Whiskers).',
          },
          tints: {
            type: 'array',
            description: 'Tints for the critter layers',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#channelTint',
            },
          },
          state: {
            type: 'array',
            description:
              'State values for this critter placement, overriding stateProperty defaults.',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#stateValue',
            },
            maxLength: 32,
          },
        },
      },
    },
  },
  AtCozyCornerHouseUpdatePresence: {
    lexicon: 1,
    id: 'at.cozy-corner.house.updatePresence',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Send an intent to the server. The server identifies the caller from auth and their room session (established by the presence subscription).',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.house.updatePresence#moveTo',
              'lex:at.cozy-corner.house.updatePresence#activate',
              'lex:at.cozy-corner.house.updatePresence#say',
              'lex:at.cozy-corner.house.updatePresence#promptResponse',
            ],
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['id'],
            properties: {
              id: {
                type: 'union',
                refs: [
                  'lex:at.cozy-corner.house.defs#did',
                  'lex:at.cozy-corner.house.defs#anonymousId',
                ],
                description: 'Your ID.',
              },
            },
          },
        },
      },
      moveTo: {
        type: 'object',
        description:
          'Move avatar to a target tile. Server runs pathfinding authoritatively.',
        required: ['type', 'x', 'y'],
        properties: {
          type: {
            type: 'string',
            const: 'moveTo',
          },
          x: {
            type: 'integer',
            description: 'Target tile x position.',
            minimum: -500,
            maximum: 500,
          },
          y: {
            type: 'integer',
            description: 'Target tile y position.',
            minimum: -500,
            maximum: 500,
          },
        },
      },
      activate: {
        type: 'object',
        description: 'Activate the entity at the given tile.',
        required: ['type', 'x', 'y'],
        properties: {
          type: {
            type: 'string',
            const: 'activate',
          },
          x: {
            type: 'integer',
            description: 'Target tile x position.',
            minimum: -500,
            maximum: 500,
          },
          y: {
            type: 'integer',
            description: 'Target tile y position.',
            minimum: -500,
            maximum: 500,
          },
        },
      },
      say: {
        type: 'object',
        description: 'Express an emoji in a speech or thought bubble.',
        required: ['type', 'emoji', 'bubble'],
        properties: {
          type: {
            type: 'string',
            const: 'say',
          },
          emoji: {
            type: 'string',
            description: 'The emoji character(s) to display.',
            maxLength: 32,
          },
          bubble: {
            type: 'string',
            description: 'Bubble style.',
            enum: ['thought', 'speech'],
          },
        },
      },
      promptResponse: {
        type: 'object',
        description: 'Respond to an active prompt from an NPC or item.',
        required: ['type', 'response'],
        properties: {
          type: {
            type: 'string',
            const: 'promptResponse',
          },
          response: {
            type: 'string',
            description: 'The selected response option.',
          },
        },
      },
    },
  },
  AtCozyCornerInventory: {
    lexicon: 1,
    id: 'at.cozy-corner.inventory',
    defs: {
      main: {
        type: 'record',
        description:
          "Indicates that a record has been added to the user's inventory.",
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AtCozyCornerItem: {
    lexicon: 1,
    id: 'at.cozy-corner.item',
    defs: {
      main: {
        type: 'record',
        description:
          'An item definition. Can be created by any user and referenced by others to place in their houses.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'spriteSheet', 'layers', 'variants', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              maxLength: 640,
              maxGraphemes: 64,
              description: 'Display name for the item.',
            },
            description: {
              type: 'string',
              maxLength: 2560,
              maxGraphemes: 256,
              description: 'Free-form description of the item.',
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
                maxLength: 64,
                maxGraphemes: 64,
                description: 'A tag for the item.',
              },
            },
            spriteSheet: {
              type: 'blob',
              accept: ['image/png', 'image/webp'],
              maxSize: 5000000,
            },
            layers: {
              type: 'array',
              description: 'layers of the item',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#animationLayer',
              },
            },
            variants: {
              type: 'array',
              description:
                'Alternative visual appearances for this item. Each variant has a name and can set initial state values.',
              minLength: 1,
              maxLength: 16,
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.item#variant',
              },
            },
            behaviors: {
              type: 'array',
              description:
                'Lua scripts that define how this item responds to events.',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.script#script',
              },
              maxLength: 16,
            },
            stateProperties: {
              type: 'array',
              description:
                'Declares the configurable state properties for this item. Behaviors read these via entityState; variants and placements can override values.',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#stateProperty',
              },
              maxLength: 32,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      variant: {
        type: 'object',
        description:
          'A named visual variant for an item. Sets spatial properties and can override state values.',
        required: ['name', 'target'],
        properties: {
          name: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
            description: 'Display name for this variant.',
          },
          target: {
            type: 'string',
            description:
              'The layer target of the layers to render for this variant.',
          },
          itemWidth: {
            type: 'integer',
            description: 'Width of the item in tiles.',
            minimum: 1,
          },
          itemHeight: {
            type: 'integer',
            description: 'Height of the item in tiles.',
            minimum: 1,
          },
          blockedEdges: {
            type: 'array',
            description:
              'Per-tile edge blocking as a flat array of width * height (row-major). Each value is a bitmask: bits 0-3 = physical blocking per direction (N=1, E=2, S=4, W=8), bits 4-7 = ephemeral blocking per direction (N=16, E=32, S=64, W=128). Physical blocks movement; ephemeral blocks light/sound/heat. A fully blocked square has value 15 (physical) or 255 (both). 0 = no blocking.',
            items: {
              type: 'integer',
              minimum: 0,
              maximum: 255,
            },
            maxLength: 4096,
          },
          state: {
            type: 'array',
            description:
              'State values set by this variant, overriding stateProperty defaults.',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#stateValue',
            },
            maxLength: 32,
          },
        },
      },
    },
  },
  AtCozyCornerScript: {
    lexicon: 1,
    id: 'at.cozy-corner.script',
    defs: {
      script: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Display name for the script.',
            maxLength: 256,
          },
          code: {
            type: 'string',
            description:
              'Inline Lua source code. Mutually exclusive with codeBlob.',
            maxLength: 10000,
            maxGraphemes: 10000,
          },
          codeBlob: {
            type: 'blob',
            description:
              'Lua source code stored as a blob. Mutually exclusive with code.',
            accept: ['text/x-lua'],
            maxSize: 100000,
          },
        },
      },
    },
  },
  AtCozyCornerSettings: {
    lexicon: 1,
    id: 'at.cozy-corner.settings',
    defs: {
      main: {
        type: 'record',
        description:
          'User preferences for Cozy Corner. One per DID. Controls how linked AT Protocol content is rendered when visiting any house.',
        key: 'literal:self',
        record: {
          type: 'object',
          required: ['createdAt'],
          properties: {
            serviceHandlers: {
              type: 'array',
              description:
                'Preferred front-end services for viewing linked AT Protocol content in iframe overlays. Each entry maps a record collection to a preferred service. When a linkAction is triggered, the client looks up the collection NSID from the at-uri and uses the matching service handler to construct the embed URL. If no handler is configured, the client falls back to a built-in default.',
              maxLength: 32,
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.settings#serviceHandler',
              },
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      serviceHandler: {
        type: 'object',
        description:
          'Maps an AT Protocol record collection to a web front-end URL for iframe embedding. The urlTemplate is interpolated with {{authority}} (DID or handle) and {{key}} (record key) to produce the embed URL.',
        required: ['collection', 'urlTemplate'],
        properties: {
          collection: {
            type: 'string',
            description:
              'NSID of the record collection this handler applies to.',
            knownValues: ['app.bsky.feed.post', 'com.whtwnd.blog.entry'],
          },
          urlTemplate: {
            type: 'string',
            description:
              "URL template for embedding content. Use {{authority}} for the DID/handle and {{key}} for the record key. Example: 'https://bsky.app/profile/{{authority}}/post/{{key}}'.",
            maxLength: 2560,
          },
        },
      },
    },
  },
  AtCozyCornerStarterPack: {
    lexicon: 1,
    id: 'at.cozy-corner.starterPack',
    defs: {
      main: {
        type: 'record',
        description:
          "A curated bundle of items and wearables that can be added to a user's inventory in one action. Items and wearables can reference definitions from any PDS, so pack creators can mix and match content from different users.",
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              maxLength: 640,
              maxGraphemes: 64,
              description: 'Display name for the starter pack.',
            },
            description: {
              type: 'string',
              maxLength: 2560,
              maxGraphemes: 256,
              description: 'Free-form description of the starter pack.',
            },
            splash: {
              type: 'blob',
              description: 'Preview image for the starter pack.',
              accept: ['image/png', 'image/webp', 'image/jpeg'],
              maxSize: 1000000,
            },
            entries: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#categorizedEntry',
              },
              maxLength: 256,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AtCozyCornerTileset: {
    lexicon: 1,
    id: 'at.cozy-corner.tileset',
    defs: {
      main: {
        type: 'record',
        description:
          'A tileset definition. Named tiles referencing regions from a sprite sheet',
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'spriteSheet', 'layers', 'tiles', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              maxLength: 640,
              maxGraphemes: 64,
              description: 'Display name for the tileset.',
            },
            description: {
              type: 'string',
              maxLength: 2560,
              maxGraphemes: 256,
              description: 'Free-form description of the tileset.',
            },
            tags: {
              type: 'array',
              description: 'Tags for the tileset.',
              items: {
                type: 'string',
                maxLength: 640,
                maxGraphemes: 64,
              },
              maxLength: 16,
            },
            spriteSheet: {
              type: 'blob',
              accept: ['image/png', 'image/webp'],
              maxSize: 5000000,
            },
            layers: {
              type: 'array',
              description: 'Layers in the tileset',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#animationLayer',
              },
            },
            tiles: {
              type: 'array',
              description: 'Tiles in the tileset',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.tileset#tile',
              },
              minLength: 1,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      tile: {
        type: 'object',
        description: 'A tile in the tileset',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'The name of the tile',
          },
          target: {
            type: 'string',
            description: 'The target of the tile in the layers',
          },
          wall: {
            type: 'boolean',
            description:
              'Whether this tile is a wall. Used to auto-generate blocking edges in the room editor.',
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true,
): ValidationResult<T>
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false,
): ValidationResult<T>
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean,
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`,
        ),
      }
}

export const ids = {
  AtCozyCornerAvatar: 'at.cozy-corner.avatar',
  AtCozyCornerAvatarBase: 'at.cozy-corner.avatar.base',
  AtCozyCornerAvatarWearable: 'at.cozy-corner.avatar.wearable',
  AtCozyCornerBehavior: 'at.cozy-corner.behavior',
  AtCozyCornerCritter: 'at.cozy-corner.critter',
  AtCozyCornerDefs: 'at.cozy-corner.defs',
  AtCozyCornerHouse: 'at.cozy-corner.house',
  AtCozyCornerHouseDefs: 'at.cozy-corner.house.defs',
  AtCozyCornerHousePresence: 'at.cozy-corner.house.presence',
  AtCozyCornerHouseRoom: 'at.cozy-corner.house.room',
  AtCozyCornerHouseUpdatePresence: 'at.cozy-corner.house.updatePresence',
  AtCozyCornerInventory: 'at.cozy-corner.inventory',
  AtCozyCornerItem: 'at.cozy-corner.item',
  AtCozyCornerScript: 'at.cozy-corner.script',
  AtCozyCornerSettings: 'at.cozy-corner.settings',
  AtCozyCornerStarterPack: 'at.cozy-corner.starterPack',
  AtCozyCornerTileset: 'at.cozy-corner.tileset',
} as const
