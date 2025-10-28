// Minimal v8-style typings to satisfy TS locally without overriding runtime
// This shim declares only the pieces we use; runtime comes from the real pixi.js package.
declare module 'pixi.js' {
  class Container {
    eventMode?: any;
    hitArea?: any;
    addChild<T = any>(...children: any[]): T;
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

  class Graphics extends Container {
    clear(): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    closePath(): this;
    fill(style?: any): this;
  }

  export { Application, Container, Graphics };
}
