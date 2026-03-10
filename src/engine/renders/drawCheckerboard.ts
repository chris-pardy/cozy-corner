export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scale: number,
) {
  const checkSize = scale * 4;
  for (let cy = 0; cy < h; cy += checkSize) {
    for (let cx = 0; cx < w; cx += checkSize) {
      ctx.fillStyle =
        (Math.floor(cx / checkSize) + Math.floor(cy / checkSize)) % 2 === 0
          ? "#1a2035"
          : "#141a2e";
      ctx.fillRect(cx, cy, checkSize, checkSize);
    }
  }
}

