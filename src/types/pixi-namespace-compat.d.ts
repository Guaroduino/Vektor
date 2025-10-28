// Small compatibility augmentation to expose certain classes on the
// `PIXI` namespace for code that uses `import * as PIXI from 'pixi.js'`
// This avoids a large refactor while keeping strong typing from the
// official `pixi.js` package. We keep these as `any` to be minimal and
// narrow in scope — they only provide the missing namespace properties
// that the app expects at compile-time.
declare module 'pixi.js' {
  // Runtime values attached to the namespace in many examples.
  export const Shader: any;
  export const Geometry: any;
  export const Mesh: any;
  export const State: any;
  export const FederatedPointerEvent: any;
  export const extensions: { add(plugin: any): void };
  export const TickerPlugin: any;
  export const EventSystem: any;
}

export {};
