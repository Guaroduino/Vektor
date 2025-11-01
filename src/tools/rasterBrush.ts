import type { Tool, ToolContext, ToolParams, ToolPointerEvent } from '../core/interfaces';
// Ensure Pixi classes bundle
import 'pixi.js';
import LayerManager from '../core/LayerManager';

export class RasterBrushTool implements Tool {
  readonly id = 'raster-brush';
  readonly label = 'Raster Brush';

  private DEBUG = true;
  private log(...args: any[]) { if (this.DEBUG) console.log('[RasterTool]', ...args); }

  private layers: LayerManager;
  private ctx?: ToolContext;
  private worker?: Worker; // geometry worker
  // private sprite?: any; // reserved for future blend/size sync if needed
  private isDrawing = false;
  private params: Required<Pick<ToolParams, 'size'|'alpha'|'colorRGB'>> & Partial<ToolParams> = {
    size: 16, alpha: 1, colorRGB: [1,1,1],
  };

  constructor(layers: LayerManager) {
    this.layers = layers;
  }

  onActivate(ctx: ToolContext, params: ToolParams): void {
    this.log('onActivate', { ctx, params });
    this.ctx = ctx;
    this.params = { ...this.params, ...params } as any;
    this.initLayer();
    this.initWorker();
    this.pushParams();
  }

  onDeactivate(): void {
    this.log('onDeactivate');
    if (this.worker) { this.worker.terminate(); this.worker = undefined; }
    this.isDrawing = false;
  }

  onParamsChange(params: ToolParams): void {
    this.log('onParamsChange', params);
    this.params = { ...this.params, ...params } as any;
    this.pushParams();
  }

  onPointer(evt: ToolPointerEvent): void {
    this.log('onPointer', evt.type, { x: evt.x, y: evt.y, p: evt.pressure, t: evt.timeStamp });
    if (!this.worker) return;
    if (evt.type === 'down') {
      this.isDrawing = true;
      this.worker.postMessage({ type: 'reset' });
      // Send params on stroke start so worker has latest
      this.pushParams();
      this.worker.postMessage({ type: 'points', points: [{ x: evt.x, y: evt.y, p: evt.pressure ?? 1, t: evt.timeStamp ?? performance.now() }] });
      return;
    }
    if (evt.type === 'move') {
      if (!this.isDrawing) return;
      this.worker.postMessage({ type: 'points', points: [{ x: evt.x, y: evt.y, p: evt.pressure ?? 1, t: evt.timeStamp ?? performance.now() }] });
      return;
    }
    if (evt.type === 'up' || evt.type === 'cancel') {
      this.isDrawing = false;
      if (this.worker) this.worker.postMessage({ type: 'reset' });
      return;
    }
  }

  clear(): void {
    this.layers.clearActive();
  }

  // ---- internals ----

  private initLayer() {
  this.layers.ensureRasterLayer();
  }

  private initWorker() {
    if (!this.ctx) return;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Vite bundles TS workers
    const w = new Worker(new URL('../stroke.geom.worker.ts', import.meta.url), { type: 'module' });
    this.worker = w;
    this.log('initWorker postMessage init', { width: this.ctx.width, height: this.ctx.height });
    w.postMessage({ type: 'init', width: this.ctx.width, height: this.ctx.height });
    w.onmessage = (ev: MessageEvent) => {
      const data: any = ev.data;
      if (data?.type === 'log') this.log('[worker]', data.msg);
      if (data?.type === 'geometry' && data.positions && data.colors && data.indices) {
        this.layers.rasterizeGeometry(data.positions as Float32Array, data.colors as Float32Array, data.indices as Uint16Array);
      }
    };
    // No resize handling for MVP. Clearing raster recreates the RT at correct size.
  }

  private pushParams() {
    if (!this.worker) return;
    this.worker.postMessage({ type: 'params', size: this.params.size, alpha: this.params.alpha, colorRGB: this.params.colorRGB, sizeFromSpeed: this.params.sizeFromSpeed, speedInfluence: this.params.speedInfluence });
  }

  // rgbToHex no longer used; geometry worker accepts colorRGB directly
  // No texture update paths needed; rasterization happens via LayerManager
}

export default RasterBrushTool;
