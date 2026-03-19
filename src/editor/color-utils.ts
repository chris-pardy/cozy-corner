/**
 * Color utility functions shared across editor components.
 */

/** Parse a hex color string to an RGBA tuple (alpha is always 255). */
export function hexToRgba(hex: string): [number, number, number, number];
/** Parse a hex color string to a CSS `rgba()` string with the given alpha. */
export function hexToRgba(hex: string, alpha: number): string;
export function hexToRgba(
  hex: string,
  alpha?: number,
): [number, number, number, number] | string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (alpha !== undefined) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return [r, g, b, 255];
}
