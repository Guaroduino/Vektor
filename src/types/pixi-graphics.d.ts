// Augment PIXI.Graphics to include beginHole/endHole used for rendering holes
// This is a minimal declaration to satisfy TypeScript; methods exist at runtime in PIXI.Graphics.
declare module 'pixi.js' {
  interface Graphics {
    /** Begin defining a hole inside the current fill */
    beginHole(): this;
    /** End the current hole definition */
    endHole(): this;
  }
}
