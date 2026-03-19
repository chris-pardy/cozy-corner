# Cozy Corner Sprite & Tile Conventions

## Tile Size

All tiles use a **32×16 pixel** isometric diamond (2:1 width-to-height ratio).

This is the global tile size — all rooms share it so that item sprites from
different creators are interoperable.

## Room Dimensions

Rooms are sized in tiles. Each room can be **1–64 tiles** wide and **1–64 tiles**
tall. A typical cozy room is around 8×8 to 12×12 tiles.

## Item Sprite Sheets

Item sprites are packed into a single PNG sprite sheet:

```
         ┌─── frame 0 ───┬─── frame 1 ───┐  (columns = animation frames)
 angle 0 │               │               │  south
 angle 1 │               │               │  west
 angle 2 │               │               │  north
 angle 3 │               │               │  east
         └───────────────┴───────────────┘
```

- **Rows** = 4 angles (south, west, north, east)
- **Columns** = animation frames (1 for static items)
- Each frame is `frameWidth × frameHeight` pixels
- `frameCount` = number of columns, `frameDuration` = ms per frame
- Static items have `frameCount: 1` (single column)
- Items with only 1 angle have a single row

The item's tile footprint is defined by `tileWidth × tileHeight` (default 1×1).

## Avatar Sprite Sheets

Avatar base sprites follow the same 4-angle row layout as items.
Typical avatar size: **32px wide × 64px tall** per frame.

## Wearable Overlay Sprites

Wearable sprite sheets must match the avatar's frame layout exactly
(same dimensions, same number of angles/frames). They are composited on top
of the avatar using alpha transparency. The `wearables` array on the avatar
record controls render order — first element is the bottom layer.

## Image Formats

All sprite blobs accept `image/png` and `image/webp`.
- PNG is preferred for pixel art (lossless, transparency)
- Max sizes: tiles 256KB, sprites/wearables 1MB, item sheets 5MB

## Floor & Wall Tiles

- Floor tiles: 32×16 isometric diamond PNGs
- Wall tiles: isometric wall segments (optional — omit `wallTile` for outdoor rooms)
- Background images: full-canvas backdrops for outdoor rooms (up to 2MB)

## Sprite Refs & Tile Packs

All sprite fields (`sprite`, `backSprite`, room `tileset`) use a `spriteRef` object
instead of a bare blob. A spriteRef wraps a BlobRef with optional source region:

```json
{
  "image": <BlobRef>,
  "sourceX": 64,
  "sourceY": 0,
  "sourceWidth": 32,
  "sourceHeight": 48
}
```

- When source fields are omitted, the entire blob is used (simple case)
- Multiple records can share the same blob CID with different source regions
- The PDS deduplicates storage by CID; the browser caches by blob URL
- This enables **tile packs** — one atlas image containing many sprites

### Tile Pack Usage

Upload one large atlas PNG as a blob, then create multiple item/wearable records
that all reference the same blob with different `sourceX`/`sourceY` regions:

1. Upload atlas → get BlobRef with CID
2. Item A: `sprite: { image: <BlobRef>, sourceX: 0, sourceY: 0 }`
3. Item B: `sprite: { image: <same BlobRef>, sourceX: 32, sourceY: 0 }`
4. Browser fetches the atlas once, caches it, samples sub-regions as needed

For items, `sourceWidth`/`sourceHeight` are optional since `frameWidth × frameCount`
and `frameHeight` already define the region size. For wearables, include
`sourceWidth`/`sourceHeight` to define the sprite dimensions within the atlas.
