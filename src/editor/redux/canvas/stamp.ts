import type { ToolStamp } from './tool';

export type DrawingTool = 'brush' | 'pencil' | 'eraser';

/**
 * Generate a circular ToolStamp for a drawing tool.
 *
 * - **pencil** — hard-edged circle filled with `color` at full alpha.
 * - **brush**  — soft-edged circle; colour fades linearly from full alpha at
 *   the centre to 0 at the rim. `opacity` (0–1) scales the overall alpha.
 * - **eraser** — hard-edged circle of transparent pixels (0x00000000).
 *
 * Stamp size is `(2 × radius − 1)²` so radius 1 → 1 px, radius 2 → 3×3, etc.
 */
export function generateStamp(
    tool: DrawingTool,
    radius: number,
    color: number,
    opacity = 1,
): ToolStamp {
    const size = Math.max(1, radius * 2 - 1);
    const cx = (size - 1) / 2;
    const cy = cx;
    const threshold = (radius - 0.5) * (radius - 0.5);

    const pixels = new Uint32Array(size * size);
    const mask = new Uint8Array(size * size);

    const r = color & 0xff;
    const g = (color >> 8) & 0xff;
    const b = (color >> 16) & 0xff;
    const a = (color >>> 24) & 0xff;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist2 = dx * dx + dy * dy;
            if (dist2 > threshold) continue;

            const idx = y * size + x;
            mask[idx] = 1;

            switch (tool) {
                case 'eraser':
                    // pixels[idx] already 0
                    break;
                case 'pencil':
                    pixels[idx] = color;
                    break;
                case 'brush': {
                    const dist = Math.sqrt(dist2);
                    const falloff = Math.max(0, 1 - dist / radius);
                    const sa = Math.round(a * falloff * opacity);
                    pixels[idx] = ((sa << 24) | (b << 16) | (g << 8) | r) >>> 0;
                    break;
                }
            }
        }
    }

    return { width: size, pixels, mask };
}
