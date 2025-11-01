// Minimal Pixi v8 typings used by this project, consolidated in one place.
// Runtime behavior comes from the installed 'pixi.js' package.
declare module 'pixi.js' {
  // Core classes needed with the minimal surface we actually use
  class Container {
    eventMode?: any;
    hitArea?: any;
    addChild<T = any>(...children: any[]): T;
    addChildAt<T = any>(child: any, index: number): T;
    on(event: string, cb: (...args: any[]) => void): void;
    alpha: number;
  }

  class Application {
    constructor(options?: any);
    init(options?: any): Promise<void>;
    readonly canvas: HTMLCanvasElement;
    readonly stage: Container;
    readonly screen: any;
  }

  // Render pipeline pieces we consume but don't need strong typing for
  // Keep them as 'any' to avoid masking behavior while keeping compile green
  const Shader: any;
  const Geometry: any;
  const Mesh: any;
  const State: any;
  const Sprite: any;
  const Texture: any;
  const RenderTexture: any;

  // Extensions/plugins used
  const TickerPlugin: any;
  const EventSystem: any;
  const extensions: { add: (...plugins: any[]) => void };

  export { Application, Container, Shader, Geometry, Mesh, State, Sprite, Texture, RenderTexture, TickerPlugin, EventSystem, extensions };
}
