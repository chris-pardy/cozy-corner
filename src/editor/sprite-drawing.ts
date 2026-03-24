/**
 * Pure drawing and image-transform algorithms used by the sprite pixel editor.
 *
 * Every function here is side-effect-free relative to React — they only operate
 * on pixel buffers, ImageData, or OffscreenCanvas contexts.
 */

// ---------------------------------------------------------------------------
// Pixel footprint helpers
// ---------------------------------------------------------------------------

/** Return all pixels in an axis-aligned square centered on (cx, cy). */
export function squarePixels(
  cx: number,
  cy: number,
  size: number,
  w: number,
  h: number,
) {
  const off = Math.floor((size - 1) / 2);
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const px = cx - off + dx;
      const py = cy - off + dy;
      if (px >= 0 && px < w && py >= 0 && py < h) out.push({ x: px, y: py });
    }
  }
  return out;
}

/** Return all pixels inside a circle of given diameter centered on (cx, cy). */
export function circlePixels(
  cx: number,
  cy: number,
  diameter: number,
  w: number,
  h: number,
) {
  const r = diameter / 2;
  const extent = Math.ceil(r);
  const out: { x: number; y: number }[] = [];
  for (let dy = -extent; dy <= extent; dy++) {
    for (let dx = -extent; dx <= extent; dx++) {
      const px = cx + dx;
      const py = cy + dy;
      if (px >= 0 && px < w && py >= 0 && py < h) {
        if (Math.sqrt((dx + 0.5) ** 2 + (dy + 0.5) ** 2) <= r) {
          out.push({ x: px, y: py });
        }
      }
    }
  }
  return out;
}

/** Return the set of pixels affected by the given tool at (x, y). */
export function toolFootprint(
  tool: string,
  x: number,
  y: number,
  size: number,
  w: number,
  h: number,
) {
  if (tool === "pencil" || tool === "eraser")
    return squarePixels(x, y, size, w, h);
  if (tool === "brush") return circlePixels(x, y, size, w, h);
  if (x >= 0 && x < w && y >= 0 && y < h) return [{ x, y }];
  return [];
}

// ---------------------------------------------------------------------------
// Line drawing
// ---------------------------------------------------------------------------

/** Bresenham's line algorithm — returns all integer pixel coordinates from (x0,y0) to (x1,y1). */
export function bresenham(x0: number, y0: number, x1: number, y1: number) {
  const pts: { x: number; y: number }[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0,
    y = y0;
  for (;;) {
    pts.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Flood fill
// ---------------------------------------------------------------------------

/** Flood-fill a pixel buffer starting at (sx, sy) with the given RGBA color. */
export function floodFill(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  sx: number,
  sy: number,
  fr: number,
  fg: number,
  fb: number,
  fa: number,
) {
  const idx = (sy * w + sx) * 4;
  const tr = buf[idx],
    tg = buf[idx + 1],
    tb = buf[idx + 2],
    ta = buf[idx + 3];
  if (tr === fr && tg === fg && tb === fb && ta === fa) return;

  const stack: number[] = [sx, sy];
  const visited = new Uint8Array(w * h);
  while (stack.length > 0) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    const i = cy * w + cx;
    if (visited[i]) continue;
    const pi = i * 4;
    if (
      buf[pi] !== tr ||
      buf[pi + 1] !== tg ||
      buf[pi + 2] !== tb ||
      buf[pi + 3] !== ta
    )
      continue;
    visited[i] = 1;
    buf[pi] = fr;
    buf[pi + 1] = fg;
    buf[pi + 2] = fb;
    buf[pi + 3] = fa;
    if (cx > 0) stack.push(cx - 1, cy);
    if (cx < w - 1) stack.push(cx + 1, cy);
    if (cy > 0) stack.push(cx, cy - 1);
    if (cy < h - 1) stack.push(cx, cy + 1);
  }
}

// ---------------------------------------------------------------------------
// Layer transform helpers — operate on one cell (frame x layer) in backing
// ---------------------------------------------------------------------------

/** Flip a cell horizontally (mirror left/right). */
export function flipH(
  backing: OffscreenCanvas,
  frame: number,
  layerId: number,
  w: number,
  h: number,
) {
  const ctx = backing.getContext("2d")!;
  const x = frame * w;
  const y = layerId * h;
  const imgData = ctx.getImageData(x, y, w, h);
  const buf = imgData.data;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < Math.floor(w / 2); col++) {
      const li = (row * w + col) * 4;
      const ri = (row * w + (w - 1 - col)) * 4;
      for (let c = 0; c < 4; c++) {
        const tmp = buf[li + c];
        buf[li + c] = buf[ri + c];
        buf[ri + c] = tmp;
      }
    }
  }
  ctx.putImageData(imgData, x, y);
}

/** Flip a cell vertically (mirror top/bottom). */
export function flipV(
  backing: OffscreenCanvas,
  frame: number,
  layerId: number,
  w: number,
  h: number,
) {
  const ctx = backing.getContext("2d")!;
  const x = frame * w;
  const y = layerId * h;
  const imgData = ctx.getImageData(x, y, w, h);
  const buf = imgData.data;
  for (let row = 0; row < Math.floor(h / 2); row++) {
    for (let col = 0; col < w; col++) {
      const ti = (row * w + col) * 4;
      const bi = ((h - 1 - row) * w + col) * 4;
      for (let c = 0; c < 4; c++) {
        const tmp = buf[ti + c];
        buf[ti + c] = buf[bi + c];
        buf[bi + c] = tmp;
      }
    }
  }
  ctx.putImageData(imgData, x, y);
}

/** Rotate a cell 90 degrees clockwise. */
export function rotateCW(
  backing: OffscreenCanvas,
  frame: number,
  layerId: number,
  w: number,
  h: number,
) {
  const ctx = backing.getContext("2d")!;
  const x = frame * w;
  const y = layerId * h;
  const temp = new OffscreenCanvas(w, h);
  const tCtx = temp.getContext("2d")!;
  tCtx.drawImage(backing, x, y, w, h, 0, 0, w, h);
  ctx.clearRect(x, y, w, h);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.PI / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(temp, -w / 2, -h / 2);
  ctx.restore();
}

/** Rotate a cell 90 degrees counter-clockwise. */
export function rotateCCW(
  backing: OffscreenCanvas,
  frame: number,
  layerId: number,
  w: number,
  h: number,
) {
  const ctx = backing.getContext("2d")!;
  const x = frame * w;
  const y = layerId * h;
  const temp = new OffscreenCanvas(w, h);
  const tCtx = temp.getContext("2d")!;
  tCtx.drawImage(backing, x, y, w, h, 0, 0, w, h);
  ctx.clearRect(x, y, w, h);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(temp, -w / 2, -h / 2);
  ctx.restore();
}

/** Scale2x pixel-art upscale: double the resolution using the Scale2x algorithm. */
export function scale2x(src: ImageData): ImageData {
  const w = src.width;
  const h = src.height;
  const dst = new ImageData(w * 2, h * 2);
  const s = src.data;
  const out = dst.data;

  const eq = (i: number, j: number) =>
    s[i] === s[j] &&
    s[i + 1] === s[j + 1] &&
    s[i + 2] === s[j + 2] &&
    s[i + 3] === s[j + 3];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const a = y > 0 ? ((y - 1) * w + x) * 4 : p;
      const dn = y < h - 1 ? ((y + 1) * w + x) * 4 : p;
      const b = x > 0 ? (y * w + (x - 1)) * 4 : p;
      const c = x < w - 1 ? (y * w + (x + 1)) * 4 : p;

      const dstW = w * 2;
      const e0 = (y * 2 * dstW + x * 2) * 4;
      const e1 = (y * 2 * dstW + x * 2 + 1) * 4;
      const e2 = ((y * 2 + 1) * dstW + x * 2) * 4;
      const e3 = ((y * 2 + 1) * dstW + x * 2 + 1) * 4;

      if (!eq(a, dn) && !eq(b, c)) {
        const s0 = eq(a, b) ? a : p;
        const s1 = eq(a, c) ? a : p;
        const s2 = eq(dn, b) ? dn : p;
        const s3 = eq(dn, c) ? dn : p;
        for (let k = 0; k < 4; k++) {
          out[e0 + k] = s[s0 + k];
          out[e1 + k] = s[s1 + k];
          out[e2 + k] = s[s2 + k];
          out[e3 + k] = s[s3 + k];
        }
      } else {
        for (let k = 0; k < 4; k++) {
          out[e0 + k] = s[p + k];
          out[e1 + k] = s[p + k];
          out[e2 + k] = s[p + k];
          out[e3 + k] = s[p + k];
        }
      }
    }
  }
  return dst;
}

/**
 * RotSprite rotation on raw ImageData: upscale 8x via Scale2x, rotate, downscale.
 * Returns a new OffscreenCanvas with the rotated result.
 */
export function rotspriteRotateImageData(
  source: ImageData,
  w: number,
  h: number,
  angleDeg: number,
): OffscreenCanvas {
  let imgData = source;
  for (let i = 0; i < 3; i++) imgData = scale2x(imgData);

  const uw = w * 8;
  const uh = h * 8;

  const upCanvas = new OffscreenCanvas(uw, uh);
  upCanvas.getContext("2d")!.putImageData(imgData, 0, 0);

  const rotCanvas = new OffscreenCanvas(uw, uh);
  const rotCtx = rotCanvas.getContext("2d")!;
  rotCtx.translate(uw / 2, uh / 2);
  rotCtx.rotate((angleDeg * Math.PI) / 180);
  rotCtx.imageSmoothingEnabled = false;
  rotCtx.drawImage(upCanvas, -uw / 2, -uh / 2);

  const downCanvas = new OffscreenCanvas(w, h);
  const downCtx = downCanvas.getContext("2d")!;
  downCtx.imageSmoothingEnabled = false;
  downCtx.drawImage(rotCanvas, 0, 0, w, h);

  return downCanvas;
}

/**
 * RotSprite rotation: upscale 8x via Scale2x, rotate, then downscale back.
 * Produces pixel-art-friendly rotations at arbitrary angles.
 */
export function rotspriteRotate(
  backing: OffscreenCanvas,
  frame: number,
  layerId: number,
  w: number,
  h: number,
  angleDeg: number,
) {
  const ctx = backing.getContext("2d")!;
  const x = frame * w;
  const y = layerId * h;

  const imgData = ctx.getImageData(x, y, w, h);
  const result = rotspriteRotateImageData(imgData, w, h, angleDeg);

  ctx.clearRect(x, y, w, h);
  ctx.drawImage(result, x, y);
}

/** Apply a translate + scale transform to a cell in the backing canvas. */
export function transformLayer(
  backing: OffscreenCanvas,
  frame: number,
  layerId: number,
  w: number,
  h: number,
  tx: number,
  ty: number,
  tw: number,
  th: number,
) {
  const ctx = backing.getContext("2d")!;
  const x = frame * w;
  const y = layerId * h;
  const temp = new OffscreenCanvas(w, h);
  const tCtx = temp.getContext("2d")!;
  tCtx.drawImage(backing, x, y, w, h, 0, 0, w, h);
  ctx.clearRect(x, y, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(temp, 0, 0, w, h, x + tx, y + ty, tw, th);
}
