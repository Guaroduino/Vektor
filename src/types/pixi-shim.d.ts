// Minimal shim for the parts of PIXI used in this project.
// This provides types so the project can compile while keeping runtime behavior
// provided by the installed `pixi.js` package.

declare module 'pixi.js' {
  // Minimal classes/values used by the app. Use `any` to avoid typing debt.
  export const Application: any;
  export const Graphics: any;
  export const FederatedPointerEvent: any;
  export const TickerPlugin: any;
  export const EventSystem: any;
  export const extensions: {
    add(plugin: any): void;
  };

  // Export an opaque namespace so `import * as PIXI from 'pixi.js'` compiles.
  const _default: any;
  export default _default;
}
