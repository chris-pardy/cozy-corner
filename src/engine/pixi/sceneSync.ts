import type { Container } from "pixi.js";
import type { Entity } from "../entity";
import type { AnimationLayer, ChannelTint } from "~/atproto/generated/types/at/cozy-corner/defs";
import {
  POSITION,
  MOVE_TARGET,
  MOVE_START_TIME,
  MOVE_SPEED,
  DEFAULT_MOVE_SPEED,
  type Position,
} from "../state/movement";
import { TILE_SIZE } from "../state/tiles";
import {
  LAYERS,
  SPRITE_SHEET,
  TARGET,
  TARGET_START_TIME,
  CHILD_RENDER_CONFIG,
  RENDER_ORDER,
  type ChildRenderConfig,
} from "../state/render";
import {
  SPEECH_TEXT,
  SPEECH_BUBBLE,
  SPEECH_START,
  SPEECH_DURATION,
  DEFAULT_SPEECH_DURATION,
} from "../state/speech";
import { TILE_POSITIONS, type PlacedTile } from "../state/tiles";
import type { LayerStackState } from "./layerStack";
import type { AnimatedTileEntry } from "./tileLayer";

interface EntityNode {
  container: Container;
  /** Layer stack state for sprite entities. */
  layerStack: LayerStackState | null;
  /** Foreground tile row animated entries. */
  tileAnimated: AnimatedTileEntry[];
  /** Speech bubble container (created/destroyed dynamically). */
  speechContainer: Container | null;
  /** Last known target, to detect target changes. */
  lastTarget: string | null;
  /** Child entity nodes (for composite entities like player). */
  children: Map<string, EntityNode>;
}

function buildChannelTintMap(tints: ChannelTint[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const { channel, tint } of tints) {
    map.set(channel, tint);
  }
  return map;
}

/** Get the visual y (interpolated if moving). */
function visualY(entity: Entity, time: number): number {
  const pos = entity.get<Position>(POSITION);
  if (!pos) return 0;
  const moveTarget = entity.get<Position>(MOVE_TARGET);
  const moveStart = entity.get<number>(MOVE_START_TIME);
  if (moveTarget && moveStart != null) {
    const speed = entity.get<number>(MOVE_SPEED) ?? DEFAULT_MOVE_SPEED;
    const t = Math.min(1, (time - moveStart) / speed);
    return pos.y + (moveTarget.y - pos.y) * t;
  }
  return pos.y;
}

/** Interpolated x position. */
function visualX(entity: Entity, time: number): number {
  const pos = entity.get<Position>(POSITION);
  if (!pos) return 0;
  const moveTarget = entity.get<Position>(MOVE_TARGET);
  const moveStart = entity.get<number>(MOVE_START_TIME);
  if (moveTarget && moveStart != null) {
    const speed = entity.get<number>(MOVE_SPEED) ?? DEFAULT_MOVE_SPEED;
    const t = Math.min(1, (time - moveStart) / speed);
    return pos.x + (moveTarget.x - pos.x) * t;
  }
  return pos.x;
}

/**
 * PixiSceneSync maps the entity tree to a pixi display tree.
 *
 * Call sync() each frame to update positions, animation frames, tints,
 * and Y-sort order. New entities get pixi containers created; removed
 * entities get their containers destroyed.
 */
export class PixiSceneSync {
  readonly worldContainer: Container;
  private nodes = new Map<string, EntityNode>();
  private pixiModules: typeof import("pixi.js") | null = null;

  constructor(worldContainer: Container) {
    this.worldContainer = worldContainer;
    this.worldContainer.sortableChildren = true;
  }

  private async ensurePixi() {
    if (!this.pixiModules) {
      this.pixiModules = await import("pixi.js");
    }
    return this.pixiModules;
  }

  /**
   * Sync entity tree state to pixi display objects.
   * Called each frame from the ticker callback.
   */
  async sync(roomEntity: Entity, time: number): Promise<void> {
    const pixi = await this.ensurePixi();
    const tileSize = roomEntity.get<number>(TILE_SIZE) ?? 32;
    const config = roomEntity.get<Map<Entity, ChildRenderConfig>>(CHILD_RENDER_CONFIG);

    // Track which entity IDs are still present
    const activeIds = new Set<string>();

    for (const child of roomEntity.children) {
      activeIds.add(child.id);

      let node = this.nodes.get(child.id);
      if (!node) {
        node = await this.createNode(child, tileSize, config, pixi);
        this.nodes.set(child.id, node);
        this.worldContainer.addChild(node.container);
      }

      // Update position (interpolated)
      const ix = visualX(child, time) * tileSize;
      const iy = visualY(child, time) * tileSize;
      node.container.x = ix;
      node.container.y = iy;

      // Update Y-sort zIndex
      const renderOrder = child.get<number>(RENDER_ORDER) ?? 0;
      node.container.zIndex = visualY(child, time) * 10000 + renderOrder;

      // Update entity transform from config
      const childConfig = config?.get(child);
      if (childConfig?.transform) {
        const tf = childConfig.transform;
        node.container.setFromMatrix(
          new pixi.Matrix(
            tf.a / 1000,
            tf.b / 1000,
            tf.c / 1000,
            tf.d / 1000,
            ix + (tf.e / 1000),
            iy + (tf.f / 1000),
          ),
        );
      }

      // Update layer stack (animation frames, target changes)
      await this.updateEntityRendering(child, node, time, tileSize, config, pixi);
    }

    // Remove nodes for entities that no longer exist
    for (const [id, node] of this.nodes) {
      if (!activeIds.has(id)) {
        this.worldContainer.removeChild(node.container);
        node.container.destroy({ children: true });
        this.nodes.delete(id);
      }
    }
  }

  private async createNode(
    entity: Entity,
    tileSize: number,
    config: Map<Entity, ChildRenderConfig> | undefined,
    pixi: typeof import("pixi.js"),
  ): Promise<EntityNode> {
    const container = new pixi.Container();
    const node: EntityNode = {
      container,
      layerStack: null,
      tileAnimated: [],
      speechContainer: null,
      lastTarget: null,
      children: new Map(),
    };

    // If entity has LAYERS (sprite entity), create initial layer stack
    const layers = entity.get<AnimationLayer[]>(LAYERS);
    const spriteSheet = entity.get<CanvasImageSource>(SPRITE_SHEET);
    const target = entity.get<string>(TARGET);
    const targetStartTime = entity.get<number>(TARGET_START_TIME);

    if (layers && spriteSheet && target && targetStartTime != null) {
      const childConfig = config?.get(entity);
      const tintMap = childConfig?.tints
        ? buildChannelTintMap(childConfig.tints)
        : new Map<string, string>();

      const { createLayerStack } = await import("./layerStack");
      node.layerStack = await createLayerStack(
        spriteSheet,
        layers,
        target,
        targetStartTime,
        tileSize,
        tintMap,
      );
      container.addChild(node.layerStack.container);
      node.lastTarget = target;
    }

    // If entity has TILE_POSITIONS (foreground tile row), build tile sprites
    const tilePosns = entity.get<PlacedTile[]>(TILE_POSITIONS);
    if (tilePosns) {
      const tileSheet = entity.find<CanvasImageSource>(
        "engine:tileSheet",
      ) as HTMLImageElement | null;
      const atlas = entity.find<any[]>("engine:tileAtlas");
      const ts = entity.find<number>("engine:tileSize");
      if (tileSheet && atlas && ts) {
        const { buildTileLayerContainer } = await import("./tileLayer");
        const { container: tileContainer, animated } =
          await buildTileLayerContainer(tileSheet, atlas, tilePosns, ts, 1);
        container.addChild(tileContainer);
        node.tileAnimated = animated;
      }
    }

    // Handle composite entity children (e.g., player with wearable layers)
    if (entity.children.length > 0) {
      for (const childEntity of entity.children) {
        const childNode = await this.createNode(
          childEntity,
          tileSize,
          config,
          pixi,
        );
        node.children.set(childEntity.id, childNode);
        container.addChild(childNode.container);
      }
    }

    return node;
  }

  private async updateEntityRendering(
    entity: Entity,
    node: EntityNode,
    time: number,
    tileSize: number,
    config: Map<Entity, ChildRenderConfig> | undefined,
    pixi: typeof import("pixi.js"),
  ): Promise<void> {
    // Update layer stack
    if (node.layerStack) {
      const target = entity.get<string>(TARGET);
      const targetStartTime = entity.get<number>(TARGET_START_TIME);

      if (target && target !== node.lastTarget) {
        // Target changed — rebuild layer stack
        const layers = entity.get<AnimationLayer[]>(LAYERS);
        const spriteSheet = entity.get<CanvasImageSource>(SPRITE_SHEET);

        if (layers && spriteSheet && targetStartTime != null) {
          node.container.removeChild(node.layerStack.container);
          node.layerStack.container.destroy({ children: true });

          const childConfig = config?.get(entity);
          const tintMap = childConfig?.tints
            ? buildChannelTintMap(childConfig.tints)
            : new Map<string, string>();

          const { createLayerStack } = await import("./layerStack");
          node.layerStack = await createLayerStack(
            spriteSheet,
            layers,
            target,
            targetStartTime,
            tileSize,
            tintMap,
          );
          node.container.addChild(node.layerStack.container);
          node.lastTarget = target;
        }
      } else {
        // Same target — just update frame indices
        const { updateLayerStack } = await import("./layerStack");
        updateLayerStack(node.layerStack, time);
      }
    }

    // Update animated foreground tiles
    if (node.tileAnimated.length > 0) {
      const { updateAnimatedTiles } = await import("./tileLayer");
      updateAnimatedTiles(node.tileAnimated, time);
    }

    // Handle speech bubbles
    const speechText = entity.get<string>(SPEECH_TEXT);
    if (speechText) {
      const start = entity.get<number>(SPEECH_START) ?? 0;
      const duration =
        entity.get<number>(SPEECH_DURATION) ?? DEFAULT_SPEECH_DURATION;
      if (time - start <= duration) {
        if (!node.speechContainer) {
          const { createSpeechBubble } = await import("./speechBubble");
          const bubble = entity.get<string>(SPEECH_BUBBLE) ?? "speech";
          node.speechContainer = await createSpeechBubble(
            speechText,
            bubble,
            tileSize,
          );
          node.container.addChild(node.speechContainer);
        }
      } else {
        // Expired — clean up
        if (node.speechContainer) {
          node.container.removeChild(node.speechContainer);
          node.speechContainer.destroy({ children: true });
          node.speechContainer = null;
        }
        entity.delete(SPEECH_TEXT);
        entity.delete(SPEECH_BUBBLE);
        entity.delete(SPEECH_START);
        entity.delete(SPEECH_DURATION);
      }
    } else if (node.speechContainer) {
      node.container.removeChild(node.speechContainer);
      node.speechContainer.destroy({ children: true });
      node.speechContainer = null;
    }

    // Recurse into composite children
    for (const childEntity of entity.children) {
      const childNode = node.children.get(childEntity.id);
      if (childNode) {
        await this.updateEntityRendering(
          childEntity,
          childNode,
          time,
          tileSize,
          config,
          pixi,
        );
      }
    }
  }

  /** Clean up all pixi objects. */
  destroy(): void {
    for (const [, node] of this.nodes) {
      node.container.destroy({ children: true });
    }
    this.nodes.clear();
  }
}
