const BUBBLE_BG = "#faf0e6";
const BUBBLE_BORDER = "#1c1814";
const BUBBLE_TEXT_COLOR = "#1c1814";
const BUBBLE_FONT = '10px "Pixelify Sans", monospace';
const BUBBLE_PAD_X = 6;
const BUBBLE_PAD_Y = 4;
const BUBBLE_RADIUS = 3;
const BUBBLE_POINTER_SIZE = 4;
const BUBBLE_OFFSET_Y = -4;

/**
 * Draw a speech or thought bubble above an entity.
 *
 * Extracted from SpeechBubbleRenderBehavior — same logic, pure function.
 */
export function drawSpeechBubbleFn(
  ctx: CanvasRenderingContext2D,
  text: string,
  bubble: string,
  tileSize: number,
): void {
  ctx.save();
  ctx.font = BUBBLE_FONT;

  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const textH = 10;

  const boxW = textW + BUBBLE_PAD_X * 2;
  const boxH = textH + BUBBLE_PAD_Y * 2;

  const boxX = (tileSize - boxW) / 2;
  const boxY = BUBBLE_OFFSET_Y - boxH - BUBBLE_POINTER_SIZE;

  if (bubble === "thought") {
    drawThoughtBubble(ctx, boxX, boxY, boxW, boxH, tileSize);
  } else {
    drawSpeechBubble(ctx, boxX, boxY, boxW, boxH, tileSize);
  }

  ctx.fillStyle = BUBBLE_TEXT_COLOR;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(text, boxX + BUBBLE_PAD_X, boxY + BUBBLE_PAD_Y);

  ctx.restore();
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tileSize: number,
): void {
  const r = BUBBLE_RADIUS;

  ctx.fillStyle = BUBBLE_BG;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  ctx.strokeStyle = BUBBLE_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();

  const cx = tileSize / 2;
  ctx.fillStyle = BUBBLE_BG;
  ctx.beginPath();
  ctx.moveTo(cx - BUBBLE_POINTER_SIZE, y + h);
  ctx.lineTo(cx, y + h + BUBBLE_POINTER_SIZE);
  ctx.lineTo(cx + BUBBLE_POINTER_SIZE, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = BUBBLE_BORDER;
  ctx.beginPath();
  ctx.moveTo(cx - BUBBLE_POINTER_SIZE, y + h);
  ctx.lineTo(cx, y + h + BUBBLE_POINTER_SIZE);
  ctx.lineTo(cx + BUBBLE_POINTER_SIZE, y + h);
  ctx.stroke();
}

function drawThoughtBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tileSize: number,
): void {
  const r = BUBBLE_RADIUS + 2;

  ctx.fillStyle = BUBBLE_BG;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  ctx.strokeStyle = BUBBLE_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();

  const cx = tileSize / 2;
  ctx.fillStyle = BUBBLE_BG;
  ctx.strokeStyle = BUBBLE_BORDER;

  ctx.beginPath();
  ctx.arc(cx - 2, y + h + 3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, y + h + 7, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
