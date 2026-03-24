/**
 * SSR-safe factory for creating a pixi.js Application.
 * Dynamically imports pixi.js to avoid server-side rendering issues.
 * Configures defaults for pixel art rendering (nearest-neighbor, no antialiasing).
 */
export async function createPixiApp(container: HTMLElement) {
  const { Application, TextureSource } = await import("pixi.js");

  // Global default: nearest-neighbor scaling for pixel art
  TextureSource.defaultOptions.scaleMode = "nearest";

  const app = new Application();
  await app.init({
    resizeTo: container,
    antialias: false,
    roundPixels: true,
    backgroundAlpha: 0,
  });

  container.appendChild(app.canvas);
  return app;
}
