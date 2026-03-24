import type { Container } from "pixi.js";

const BUBBLE_BG = 0xfaf0e6;
const BUBBLE_BORDER = 0x1c1814;
const BUBBLE_TEXT_COLOR = "#1c1814";
const BUBBLE_FONT_FAMILY = '"Pixelify Sans", monospace';
const BUBBLE_FONT_SIZE = 10;
const BUBBLE_PAD_X = 6;
const BUBBLE_PAD_Y = 4;
const BUBBLE_RADIUS = 3;
const BUBBLE_POINTER_SIZE = 4;
const BUBBLE_OFFSET_Y = -4;

/**
 * Create a pixi Container for a speech or thought bubble above an entity.
 */
export async function createSpeechBubble(
  text: string,
  bubble: string,
  tileSize: number,
): Promise<Container> {
  const { Container, Graphics, Text, TextStyle } = await import("pixi.js");

  const container = new Container();

  // Measure text width using a temporary Text object
  const style = new TextStyle({
    fontFamily: BUBBLE_FONT_FAMILY,
    fontSize: BUBBLE_FONT_SIZE,
    fill: BUBBLE_TEXT_COLOR,
  });
  const textObj = new Text({ text, style });
  const textW = textObj.width;
  const textH = BUBBLE_FONT_SIZE;

  const boxW = textW + BUBBLE_PAD_X * 2;
  const boxH = textH + BUBBLE_PAD_Y * 2;
  const boxX = (tileSize - boxW) / 2;
  const boxY = BUBBLE_OFFSET_Y - boxH - BUBBLE_POINTER_SIZE;

  const g = new Graphics();

  if (bubble === "thought") {
    // Thought bubble: rounded rect + trailing dots
    const r = BUBBLE_RADIUS + 2;
    g.roundRect(boxX, boxY, boxW, boxH, r);
    g.fill(BUBBLE_BG);
    g.roundRect(boxX, boxY, boxW, boxH, r);
    g.stroke({ color: BUBBLE_BORDER, width: 1 });

    const cx = tileSize / 2;
    g.circle(cx - 2, boxY + boxH + 3, 2);
    g.fill(BUBBLE_BG);
    g.circle(cx - 2, boxY + boxH + 3, 2);
    g.stroke({ color: BUBBLE_BORDER, width: 1 });
    g.circle(cx, boxY + boxH + 7, 1.5);
    g.fill(BUBBLE_BG);
    g.circle(cx, boxY + boxH + 7, 1.5);
    g.stroke({ color: BUBBLE_BORDER, width: 1 });
  } else {
    // Speech bubble: rounded rect + pointer triangle
    g.roundRect(boxX, boxY, boxW, boxH, BUBBLE_RADIUS);
    g.fill(BUBBLE_BG);
    g.roundRect(boxX, boxY, boxW, boxH, BUBBLE_RADIUS);
    g.stroke({ color: BUBBLE_BORDER, width: 1 });

    const cx = tileSize / 2;
    // Pointer triangle
    g.moveTo(cx - BUBBLE_POINTER_SIZE, boxY + boxH);
    g.lineTo(cx, boxY + boxH + BUBBLE_POINTER_SIZE);
    g.lineTo(cx + BUBBLE_POINTER_SIZE, boxY + boxH);
    g.closePath();
    g.fill(BUBBLE_BG);

    g.moveTo(cx - BUBBLE_POINTER_SIZE, boxY + boxH);
    g.lineTo(cx, boxY + boxH + BUBBLE_POINTER_SIZE);
    g.lineTo(cx + BUBBLE_POINTER_SIZE, boxY + boxH);
    g.stroke({ color: BUBBLE_BORDER, width: 1 });
  }

  container.addChild(g);

  // Position text inside the bubble
  textObj.x = boxX + BUBBLE_PAD_X;
  textObj.y = boxY + BUBBLE_PAD_Y;
  container.addChild(textObj);

  return container;
}
