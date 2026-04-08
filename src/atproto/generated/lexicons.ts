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
          "A user's avatar. One per DID. Wearables composite in array order.",
        key: 'literal:self',
        record: {
          type: 'object',
          required: ['baseAvatar', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              minGraphemes: 1,
              maxGraphemes: 64,
              description: 'Display name for the avatar.',
            },
            baseAvatar: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
              description: 'Reference to the base avatar record.',
            },
            baseAvatarTints: {
              type: 'array',
              description: 'Tints for the base avatar layers',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#channelTint',
              },
            },
            wearables: {
              type: 'array',
              description:
                'Equipped wearables in composite order (first = bottom layer). Behind layers are composited in revere order',
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
            description: 'Reference to the wearable record.',
          },
          tints: {
            type: 'array',
            description: 'Tints for the wearable layers',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#channelTint',
            },
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
              minGraphemes: 2,
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
                'Animation layers for the base avatar. A complete base avatar should provide layers for the well-known targets: idle (south/north/east/west), walk (south/north/east/west), sit (south/north/east/west), hold (south/north/east/west), push (south/north/east/west), pickup (south/north/east/west), and dance. Frame count and frame rate are per-layer. Authoring tools may generate east/west by mirroring.',
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
                ref: 'lex:at.cozy-corner.defs#behavior',
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
              'idle-south',
              'idle-north',
              'idle-east',
              'idle-west',
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
      behavior: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Name for the script.',
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
              type: 'string',
              format: 'at-uri',
              description:
                "Reference to the entry room record (at.cozy-corner.house.room). Visitors spawn in this room's spawn area.",
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
                ref: 'lex:at.cozy-corner.defs#behavior',
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
        required: ['id', 'name', 'target'],
        properties: {
          id: {
            type: 'string',
            format: 'tid',
            description:
              'The unique id of the variant (unique within the item)',
          },
          name: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
            description: 'Display name for this variant.',
          },
          target: {
            type: 'string',
            description:
              'The default layer target of the layers to render for this variant.',
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
  AtCozyCornerNpc: {
    lexicon: 1,
    id: 'at.cozy-corner.npc',
    defs: {
      main: {
        type: 'record',
        description:
          'A npc definition — an autonomous character that roams rooms. NPCs have directional stateful animations (like avatars) and declarative behaviors that control movement, reactions, and timing via the behavior model.',
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
                'Display name for this npc type (e.g. Tabby Cat, Goldfish).',
            },
            description: {
              type: 'string',
              maxLength: 2560,
              maxGraphemes: 256,
              description: 'Free-form description of the npc.',
            },
            tags: {
              type: 'array',
              description: 'Tags for the npc.',
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
              description: 'layers of the npc',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#animationLayer',
              },
            },
            behaviors: {
              type: 'array',
              description:
                'Lua scripts that define how this npc responds to events (e.g. seeking tiles on a timer, reacting to nearby entities).',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.script#script',
              },
              maxLength: 16,
            },
            stateProperties: {
              type: 'array',
              description:
                'Declares the configurable state properties for this npc. Behaviors read these via entityState; placements can override values.',
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
  AtCozyCornerRoom: {
    lexicon: 1,
    id: 'at.cozy-corner.room',
    defs: {
      main: {
        type: 'record',
        description:
          'A Cozy Corner room. Rooms reference tilesets, items, and critters for a users inventory',
        key: 'tid',
        required: ['name'],
        record: {
          type: 'object',
          required: ['name', 'tileset', 'tiles', 'createdAt'],
          properties: {
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
                ref: 'lex:at.cozy-corner.room#tile',
              },
            },
            background: {
              type: 'union',
              description:
                'Background rendered behind the tile grid. Can be a solid color, gradient, or image.',
              refs: [
                'lex:at.cozy-corner.room#backgroundImage',
                'lex:at.cozy-corner.room#backgroundColor',
                'lex:at.cozy-corner.room#backgroundGradient',
              ],
            },
            items: {
              type: 'array',
              description: 'Items placed in the room',
              maxLength: 64,
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.room#roomItem',
              },
            },
            npcs: {
              type: 'array',
              description:
                'npcs placed in the room. Each entry spawns an npc at the given position.',
              maxLength: 16,
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.room#roomNpc',
              },
            },
            behaviors: {
              type: 'array',
              description:
                'Lua scripts that define how this room responds to events (e.g. cutscenes on enter, ambient effects).',
              items: {
                type: 'ref',
                ref: 'lex:at.cozy-corner.defs#behavior',
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
          'A per-tile attribute score array. Values use the 0-100 scale',
        required: ['attribute', 'value'],
        properties: {
          attribute: {
            type: 'string',
            description: "Attribute name (e.g. 'light', 'heat', 'sound').",
            maxLength: 64,
          },
          value: {
            type: 'integer',
            description: 'Each value is 0-100 where 100 is neutral.',
            minimum: 0,
            maximum: 100,
          },
        },
      },
      tile: {
        type: 'object',
        description: 'A tile position within a room',
        required: ['x', 'y'],
        properties: {
          layers: {
            type: 'array',
            description: 'Layers for the tile',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.room#tileLayer',
            },
            maxLength: 8,
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
          blocking: {
            type: 'integer',
            description:
              'Each value is a bitmask: bits 0-3 = physical blocking per direction (N=1, E=2, S=4, W=8), bits 4-7 = ephemeral blocking per direction (N=16, E=32, S=64, W=128). Physical blocks movement; ephemeral blocks light/sound/heat. A fully blocked tile has value 15 (physical) or 255 (both). 0 = no blocking.',
            minimum: 0,
            maximum: 255,
            default: 0,
          },
          spawn: {
            type: 'boolean',
            description:
              'Whether this tile is a valid spawn tile. If omitted or false, the tile is not a valid spawn tile.',
            default: false,
          },
          exit: {
            type: 'union',
            refs: [
              'lex:at.cozy-corner.room#exit',
              'lex:at.cozy-corner.room#selfExit',
            ],
            description: 'An exit on this tile',
          },
          attributes: {
            type: 'array',
            description: 'Attributes for the tile',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.room#tileAttribute',
            },
            maxLength: 8,
          },
        },
      },
      tileLayer: {
        type: 'object',
        description: 'A transformed animated layer for a tile',
        required: ['tileId'],
        properties: {
          tileId: {
            type: 'string',
            format: 'tid',
            description:
              'The unique id of the tile (unique within the tileset)',
          },
          layerName: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
            description:
              'Display name for the layer (e.g. Floor, Walls, Canopy).',
          },
          tints: {
            type: 'array',
            description: 'Tints for the tile layers',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#channelTint',
            },
          },
          transform: {
            type: 'integer',
            description:
              'Packed tile transform. Bits 0-2: rotation (0=0°, 1=90°, 2=180°, 3=270°). Bit 3: horizontal mirror. Bit 4: vertical mirror.',
            minimum: 0,
            maximum: 15,
            default: 0,
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
        required: ['item', 'variantId', 'x', 'y'],
        properties: {
          item: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
            description: 'Strong reference to the at.cozy-corner.item record.',
          },
          variantId: {
            type: 'string',
            format: 'tid',
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
              ref: 'lex:at.cozy-corner.room#gradientStop',
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
        description: 'A doorway or passage connecting this room to another.',
        required: ['id', 'target'],
        properties: {
          id: {
            type: 'string',
            format: 'tid',
            description: 'The unique id of the exit (unique within the room)',
          },
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
          targetExitId: {
            type: 'string',
            format: 'tid',
            description: 'The unique id of the exit in the target room',
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
      selfExit: {
        type: 'object',
        description: 'An exit that connects this room to itself',
        required: ['id', 'targetExitId'],
        properties: {
          id: {
            type: 'string',
            format: 'tid',
            description: 'The unique id of the exit (unique within the room)',
          },
          label: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
            description: 'Display label for the exit (e.g. Upstairs, Kitchen).',
          },
          targetExitId: {
            type: 'string',
            format: 'tid',
            description: 'The unique id of the exit in the target room',
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
      roomNpc: {
        type: 'object',
        description: 'A npc placed in the room.',
        required: ['npc', 'x', 'y'],
        properties: {
          npc: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
            description: 'Strong reference to the at.cozy-corner.npc record.',
          },
          x: {
            type: 'integer',
            description: 'The x position of the npc in the room',
            minimum: 0,
            maximum: 63,
          },
          y: {
            type: 'integer',
            description: 'The y position of the npc in the room',
            minimum: 0,
            maximum: 63,
          },
          name: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
            description:
              'Override display name for this npc instance (e.g. Mr. Whiskers).',
          },
          tints: {
            type: 'array',
            description: 'Tints for the npc layers',
            items: {
              type: 'ref',
              ref: 'lex:at.cozy-corner.defs#channelTint',
            },
          },
          state: {
            type: 'array',
            description:
              'State values for this npc placement, overriding stateProperty defaults.',
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
                ref: 'lex:at.cozy-corner.starterPack#categorizedEntry',
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
            knownValues: ['item', 'wearable', 'tileset', 'baseAvatar', 'npc'],
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
        required: ['id', 'name'],
        properties: {
          id: {
            type: 'string',
            format: 'tid',
            description:
              'The unique id of the tile (unique within the tileset)',
          },
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
  AtCozyCornerWearable: {
    lexicon: 1,
    id: 'at.cozy-corner.wearable',
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
                ref: 'lex:at.cozy-corner.defs#behavior',
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
  AtCozyCornerDefs: 'at.cozy-corner.defs',
  AtCozyCornerHouse: 'at.cozy-corner.house',
  AtCozyCornerInventory: 'at.cozy-corner.inventory',
  AtCozyCornerItem: 'at.cozy-corner.item',
  AtCozyCornerNpc: 'at.cozy-corner.npc',
  AtCozyCornerRoom: 'at.cozy-corner.room',
  AtCozyCornerSettings: 'at.cozy-corner.settings',
  AtCozyCornerStarterPack: 'at.cozy-corner.starterPack',
  AtCozyCornerTileset: 'at.cozy-corner.tileset',
  AtCozyCornerWearable: 'at.cozy-corner.wearable',
} as const
