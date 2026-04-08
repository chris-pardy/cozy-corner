# Cozy Corner Feature List

## Current State

**Working:**
- AT Protocol OAuth login (browser-based, PKCE + DPoP)
- Generated XRPC client with typed methods for all record types
- 4 standalone editors (sprite, avatar, wearable, NPC) as separate Bun HTML entry points
- Game engine: Redux + Pixi.js, 24fps tick loop, entities, tiles, blocking, A* pathfinding, Lua scripting
- Compositor pipeline (base avatar + wearable layering, tinting)
- AT URI resolver (handle/DID resolution, PDS record fetching)
- Lexicons for avatar, wearable, NPC, room, item, tileset, house, inventory, settings, starterPack
- Shadcn/Radix UI components, Tailwind v4, warm-hearth theme

**Not yet built:**
- Unified SPA with routing (old routes deleted in refactor)
- Server (Nitro/WebSocket code deleted in refactor)
- In-app room rendering / house view
- Room, item, tileset editors
- Dialogue system
- Inventory management UI
- Multiplayer / presence
- Bot infrastructure (server-side bot DID with record-writing capabilities)

---

## Milestone 1: Soft Launch

> Users log in, customize their avatar, enter "The Construct", meet the bot,
> opt in to updates, and claim a founding member item.

### 1.1 App Shell & Routing
- [ ] Unified SPA entry point (single index.html, React root, AuthProvider)
- [ ] TanStack Router (or minimal router) with file-based or config routes
- [ ] Route: `/` — login / landing
- [ ] Route: `/wardrobe` — avatar editor
- [ ] Route: `/room` — The Construct (game view)
- [ ] Auth guard: unauthenticated users see login, authenticated users proceed

### 1.2 Login & Onboarding
- [ ] Wire existing LoginForm + AuthContext into the SPA shell
- [ ] First-login detection (check for existing avatar record via `avatar.get`)
- [ ] Auto-provision on first login:
  - [ ] Create a base avatar record with a default base sprite
  - [ ] Create default wearable records (basic hair, basic shirt, basic pants, basic shoes)
  - [ ] Create avatar record referencing the base + equipping default wearables
  - [ ] Create inventory record seeded with the default wearables
- [ ] Redirect to `/wardrobe` on first login, `/room` on subsequent logins

### 1.3 Avatar Editor (In-App)
- [ ] Integrate avatar editor into the SPA as a route (not standalone Bun app)
- [ ] Load current avatar + equipped wearables from PDS
- [ ] Wearable equip/unequip from inventory (drag or toggle)
- [ ] Wearable z-order reordering (drag to reorder layers)
- [ ] Live preview using compositor (Pixi.js preview of assembled avatar)
- [ ] Save avatar record back to PDS on confirm
- [ ] Navigation: "Enter The Construct" button to go to `/room`

### 1.4 The Construct (Room)
- [ ] Static room definition: white/light-grey void, 2 chairs, 1 TV
  - [ ] Can be a hardcoded room config or a PDS room record from a known DID
- [ ] Room renderer: wire Pixi.js engine into a React component
  - [ ] Load room tiles + items, render via game engine
  - [ ] Spawn player entity with their avatar compositor output
- [ ] Player movement: click-to-move (A* pathfinding) or arrow key / WASD
- [ ] Camera: center on small room, follow player if room is larger

### 1.5 Item Interactions
- [ ] Chair interaction: player walks to chair, "sit" action, avatar plays sit animation (or faces chair)
- [ ] TV interaction: player activates TV, triggers founding member flow
  - [ ] UI overlay / dialog: "Claim your Founding Member recognition?"
  - [ ] On confirm: user's client writes "Golden Goose" inventory record to their own PDS
  - [ ] Visual feedback: item awarded toast or animation
- [ ] Interaction system: proximity-based action prompt (press E / tap to interact)

### 1.6 Multiplayer & Presence
- [ ] WebSocket server (Nitro route at `/_ws`) for room presence
- [ ] Server-authoritative game state: server runs room, streams full snapshots to clients
- [ ] Player join/leave: broadcast to other players in the same room
- [ ] See other players' avatars rendered via compositor
- [ ] Player input → server → snapshot cycle (no client-side prediction needed initially)
- [ ] Room instance management (who's in which room)

### 1.7 Bot Infrastructure
The greeter in The Construct is a **bot** — a real AT Protocol DID (`cozy-corner.at`)
running server-side. Bots are players, not NPCs: they have persistent state, can interact
with external services, and connect via the same WebSocket protocol as users.
Bots write to their **own** PDS repos, not to user repos.

- [ ] Bot DID: `cozy-corner.at` identity, authenticated server-side
- [ ] Bot server process: lightweight service that authenticates as the bot DID
- [ ] Bot connects to rooms as a WebSocket peer (same protocol as players)
- [ ] Bot appears as a player entity in the room (has an avatar, walks, speaks)
- [ ] Room permissions: The Construct grants `cozy-corner.at` elevated permissions
  - [ ] Can send prompt messages to target players (normal players cannot)
  - [ ] Can initiate cutscenes / camera control
- [ ] Bot scripting: simple state machine driving bot behavior
  - [ ] Detect new player entering The Construct
  - [ ] Walk toward player
  - [ ] Initiate dialogue via prompt messages over WebSocket
  - [ ] Handle opt-in responses (trigger bsky follow, store email preference)
  - [ ] Walk away / return to idle after cutscene
- [ ] Bot can be present in multiple rooms simultaneously

### 1.8 Dialogue / Prompt System
Uses the same prompt concepts that exist for NPCs/items. Bots with room permission
send prompt messages to a target user over WebSocket; client renders the prompt UI.

- [ ] Prompt UI component (text, speaker name, portrait/sprite)
- [ ] Multi-step prompt progression (next button / advance key)
- [ ] Prompt choices (for the opt-in step)
- [ ] Bot → server → target client prompt delivery over WebSocket
- [ ] Player responses sent back to bot via WebSocket
- [ ] Player movement locked during active prompt

### 1.9 Server
- [ ] Nitro server: WebSocket route, health check, static asset serving
- [ ] Bot host: run the greeter bot process (same server or sidecar)
- [ ] Deploy target: Fly.io (restore Dockerfile + fly.toml)
- [ ] Environment: bot DID credentials, PDS endpoint config

---

## Milestone 2: Early Alpha

> The Construct is replaced by the Cozy Corner town square. Users arrive via
> train station, meet the mayor, visit shops, and get access to the room editor.

### 2.1 Town Square
- [ ] Design town square room: train station entrance, central plaza, shop buildings
- [ ] Room record authored by the `cozy-corner.at` DID
- [ ] Tileset records for town square (cobblestone, grass, building exteriors, etc.)
- [ ] Item records for town furniture (benches, fountain, signs, lampposts)
- [ ] Replace The Construct as the default room on login
- [ ] Train station arrival animation/transition for new users

### 2.2 Room Navigation / Exits
- [ ] Tile exit system: walk onto an exit tile to transition to another room
- [ ] Room loading: resolve target room AT URI, fetch record, load into engine
- [ ] Transition effect (fade, slide, or iris wipe)
- [ ] Back/exit: return to town square from shops

### 2.3 Mayor Bot
- [ ] Same `cozy-corner.at` bot DID, new behavior script for mayor role
- [ ] Greeting dialogue for new users (explains Cozy Corner, the town, what to do)
- [ ] Idle behavior: patrols town center or stands near a landmark
- [ ] Interactable: player can talk to mayor at any time for hints

### 2.4 Shops
Each shop is a separate room accessible from the town square via door/exit tiles.

#### Interior Design Shop (Tilesets)
- [ ] Shop room with NPC shopkeeper
- [ ] Browse available tilesets (from `cozy-corner.at` DID's records)
- [ ] "Add to inventory" action: user's client writes to their own PDS
- [ ] Preview tilesets in-shop (display tiles in the room or UI panel)

#### Furniture Shop (Items)
- [ ] Shop room with NPC shopkeeper
- [ ] Browse items: tables, chairs, beds, shelves, decorations
- [ ] Add to inventory action (user writes to own PDS)
- [ ] Item preview (show sprite, description)

#### Garden Center (Plants + Ground Tiles)
- [ ] Shop room with NPC shopkeeper
- [ ] Browse: flowers, trees, bushes, grass tiles, paths
- [ ] Add to inventory action (user writes to own PDS)

### 2.5 Inventory System
- [ ] Inventory record management (add/remove items, wearables, tilesets)
- [ ] Inventory UI: categorized grid (wearables, items, tilesets)
- [ ] Item count / capacity (if limited)
- [ ] Inventory accessible from avatar editor and room editor

### 2.6 Room Editor (In-App)
- [ ] Route: `/editor` or `/home/edit`
- [ ] Integrate room editing into the SPA
- [ ] Tile palette: browse tilesets from inventory, paint tiles onto grid
- [ ] Item placement: drag items from inventory onto room grid
- [ ] NPC placement (limited to mayor-provided NPCs for now)
- [ ] Room properties: name, size, background
- [ ] Tile blocking: mark tiles as walkable/blocked
- [ ] Spawn point: set where players appear
- [ ] Exit tiles: link to other rooms (own rooms or town square)
- [ ] Save room record to PDS
- [ ] Preview mode: test your room in the game engine

### 2.7 House System
- [ ] House record: list of rooms belonging to the user
- [ ] Auto-create house + default room on first login (replaces soft launch provisioning)
- [ ] Route: `/:handle` — visit someone's house (load their house record, enter first room)
- [ ] Room-to-room navigation within a house

### 2.8 Home Editor Access
- [ ] Sign or NPC in town square that directs users to their home editor
- [ ] "Edit your home" button/NPC interaction → navigates to room editor
- [ ] Only avatar editor + room editor enabled at this stage

### 2.9 Multiplayer Enhancements
- [ ] Chat / speech bubbles (visible to all players in room)
- [ ] Friends list / online status
- [ ] Visit a friend's house from the town square

---

## Milestone 3: Expanded Alpha

> Early access to creation tools. Only records from approved DIDs render in-game.

### 3.1 Editor Integration
- [ ] Wearable editor: integrate into SPA (route: `/create/wearable`)
- [ ] Item editor: integrate into SPA (route: `/create/item`)
- [ ] NPC editor: integrate into SPA (route: `/create/npc`)
- [ ] Tileset editor: integrate into SPA (route: `/create/tileset`)
- [ ] Sprite/pixel editor: integrate as modal or sub-route (used by all above editors)
- [ ] Create page hub: `/create` with links to each editor type

### 3.2 Publishing Flow
- [ ] Save-to-PDS flow for each record type
- [ ] Record versioning: update existing records vs. create new
- [ ] Publish confirmation with preview
- [ ] "My creations" page: list all records authored by current user

### 3.3 DID Allowlist Rendering
- [ ] Maintain a list of approved creator DIDs (config file, settings record, or hardcoded)
- [ ] Room renderer: only resolve/render item, wearable, NPC, tileset records from approved DIDs
- [ ] Graceful fallback: show placeholder sprite for unapproved records
- [ ] Admin tooling: add/remove DIDs from allowlist (could be a starterPack-like record)

### 3.4 Content Discovery
- [ ] Browse other users' published records (extend PDSBrowser into SPA)
- [ ] "Add to inventory" from browse view (if creator DID is approved)
- [ ] Search/filter by tags

---

## Milestone 4: Full Beta

> All editors open to everyone. Scripts restricted to trusted parties.

### 4.1 Open Editors
- [ ] Remove DID allowlist for record rendering (all published records visible)
- [ ] All editors accessible to all authenticated users
- [ ] Content guidelines / moderation hooks

### 4.2 Script Trust System
- [ ] Lua scripts (behaviors) only execute if authored by trusted DIDs
- [ ] Trust list: curated set of DIDs allowed to publish executable scripts
- [ ] Script review/approval workflow (manual or automated)
- [ ] Untrusted scripts: behavior record exists but Lua code is not evaluated
- [ ] Visual indicator: "verified script" badge on trusted behaviors

### 4.3 Bot Kit & Hosting
- [ ] Bot-kit SDK/library: handle WebSocket connection, auth, room presence, prompt helpers
- [ ] Make it easy for community developers to build bots without low-level plumbing
- [ ] Bot hosting service: run community bots on Cozy Corner infrastructure
  - [ ] Creators deploy bots without needing their own servers
  - [ ] Resource limits / sandboxing for hosted bots

### 4.4 Polish
- [ ] Performance optimization (large rooms, many entities)
- [ ] Mobile support / responsive layout
- [ ] Accessibility pass (keyboard nav, screen reader hints)
- [ ] Error handling / offline resilience
- [ ] Analytics / telemetry (opt-in)
