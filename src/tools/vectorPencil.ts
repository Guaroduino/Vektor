import type { Tool, ToolContext, ToolParams, ToolPointerEvent } from '../core/interfaces';
import { MeshManager } from '../mesh';

type WorkerMsg =
  | { type: 'init'; width: number; height: number }
  | { type: 'params'; size: number; alpha: number; colorRGB: [number, number, number]; sizeFromSpeed?: boolean; speedInfluence?: number }
  | { type: 'reset' }
  | { type: 'points'; points: Array<{ x: number; y: number; p?: number; t?: number }> };

export class VectorPencilTool implements Tool {
  readonly id = 'vector-pencil';
  readonly label = 'Vector Pencil';

  private mesh: MeshManager;
  private ctx?: ToolContext;
  private params: Required<Pick<ToolParams, 'size'|'alpha'|'colorRGB'>> & Partial<ToolParams> = {
    size: 16, alpha: 0.1, colorRGB: [1,1,1], sizeFromSpeed: false, speedInfluence: 0.5,
  };
  private useWorker = true;
  private worker?: Worker;
  private isDrawing = false;
  private pointHistory: number[][] = [];
  private prevLeftPoint: [number, number] | null = null;
  private prevRightPoint: [number, number] | null = null;

  constructor(mesh: MeshManager, opts?: { useWorker?: boolean }) {
    this.mesh = mesh;
    if (opts && typeof opts.useWorker === 'boolean') this.useWorker = opts.useWorker;
  }

  onActivate(ctx: ToolContext, params: ToolParams): void {
    this.ctx = ctx;
    this.onParamsChange(params);
    if (this.useWorker) this.initWorker();
  }

  onDeactivate(): void {
    if (this.worker) { this.worker.terminate(); this.worker = undefined; }
    this.isDrawing = false;
    this.pointHistory = [];
    this.prevLeftPoint = this.prevRightPoint = null;
  }

  onParamsChange(params: ToolParams): void {
    this.params = { ...this.params, ...params } as any;
    if (this.worker) this.postToWorker({ type: 'params', size: this.params.size, alpha: this.params.alpha, colorRGB: this.params.colorRGB, sizeFromSpeed: this.params.sizeFromSpeed, speedInfluence: this.params.speedInfluence });
  }

  onPointer(evt: ToolPointerEvent): void {
    if (!this.ctx) return;
    if (evt.type === 'down') {
      this.isDrawing = true;
      this.pointHistory = [];
      this.prevLeftPoint = this.prevRightPoint = null;
      if (this.worker) {
        this.postToWorker({ type: 'reset' });
        this.postToWorker({ type: 'params', size: this.params.size, alpha: this.params.alpha, colorRGB: this.params.colorRGB, sizeFromSpeed: this.params.sizeFromSpeed, speedInfluence: this.params.speedInfluence });
        this.postToWorker({ type: 'points', points: [{ x: evt.x, y: evt.y, p: evt.pressure ?? 1, t: evt.timeStamp ?? performance.now() }] });
      }
      return;
    }
    if (evt.type === 'move') {
      if (!this.isDrawing) return;
      if (this.worker) {
        this.postToWorker({ type: 'points', points: [{ x: evt.x, y: evt.y, p: evt.pressure ?? 1, t: evt.timeStamp ?? performance.now() }] });
      } else {
        // Fallback: main-thread geometry similar to previous behavior
        const b: number[] = [evt.x, evt.y, evt.pressure ?? 1];
        this.pointHistory.push(b);
        if (this.pointHistory.length > 3) this.pointHistory.shift();
        if (this.pointHistory.length >= 2) {
          const bIndex = this.pointHistory.length - 1;
          const aIndex = bIndex - 1;
          const a = this.pointHistory[aIndex];
          const calculatePerpendicular = (hist: number[][], a: number[], b: number[]) => {
            if (hist.length >= 3) {
              const p_a = hist[hist.length - 3];
              const p_b = a; const p_c = b;
              let ab_dx = p_b[0] - p_a[0], ab_dy = p_b[1] - p_a[1];
              let ab_dist = Math.hypot(ab_dx, ab_dy) || 1;
              const ab_nx = ab_dx / ab_dist, ab_ny = ab_dy / ab_dist;
              let bc_dx = p_c[0] - p_b[0], bc_dy = p_c[1] - p_b[1];
              let bc_dist = Math.hypot(bc_dx, bc_dy) || 1;
              const bc_nx = bc_dx / bc_dist, bc_ny = bc_dy / bc_dist;
              let bis_x = ab_nx + bc_nx, bis_y = ab_ny + bc_ny;
              let bis_dist = Math.hypot(bis_x, bis_y);
              if (bis_dist < 0.001) { return [-ab_ny, ab_nx] as [number, number]; }
              return [-bis_y / bis_dist, bis_x / bis_dist] as [number, number];
            } else {
              let dx = b[0] - a[0], dy = b[1] - a[1];
              let dist = Math.hypot(dx, dy);
              if (dist < 0.001) return [1, 0] as [number, number];
              return [-dy / dist, dx / dist] as [number, number];
            }
          };
          const [px, py] = calculatePerpendicular(this.pointHistory, a, b);
          const bp = b[2] ?? 1;
          let speedFactor = 1.0;
          if (this.params.sizeFromSpeed && this.pointHistory.length >= 2) {
            const a2 = this.pointHistory[bIndex - 1];
            const dx = b[0] - a2[0];
            const dy = b[1] - a2[1];
            const dist = Math.hypot(dx, dy);
            const dt = 16; // ms
            const v = dist / dt; // px/ms
            const vNorm = Math.max(0, Math.min(1, v / 2));
            const minFactor = 1 - 0.8 * (this.params.speedInfluence ?? 0.5);
            speedFactor = 1 + (minFactor - 1) * vNorm;
          }
          const bWidth = (this.params.size * bp * speedFactor) * 0.5;
          const curL: [number, number] = [b[0] + px * bWidth, b[1] + py * bWidth];
          const curR: [number, number] = [b[0] - px * bWidth, b[1] - py * bWidth];
          if (this.prevLeftPoint && this.prevRightPoint) {
            this.mesh.drawSegment(this.prevLeftPoint, this.prevRightPoint, curL, curR, this.params.colorRGB, this.params.alpha);
          }
          this.prevLeftPoint = curL; this.prevRightPoint = curR;
        }
      }
      return;
    }
    if (evt.type === 'up' || evt.type === 'cancel') {
      this.isDrawing = false;
      this.pointHistory = [];
      this.prevLeftPoint = this.prevRightPoint = null;
      if (this.worker) this.postToWorker({ type: 'reset' });
      return;
    }
  }

  clear(): void {
    this.mesh.clear();
  }

  private initWorker() {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: Vite will bundle TS worker
      const w = new Worker(new URL('../stroke.geom.worker.ts', import.meta.url), { type: 'module' });
      this.worker = w;
      const width = this.ctx?.width ?? 1;
      const height = this.ctx?.height ?? 1;
      this.postToWorker({ type: 'init', width, height });
      this.postToWorker({ type: 'params', size: this.params.size, alpha: this.params.alpha, colorRGB: this.params.colorRGB, sizeFromSpeed: this.params.sizeFromSpeed, speedInfluence: this.params.speedInfluence });
      w.onmessage = (ev: MessageEvent) => {
        const data: any = ev.data;
        if (!data) return;
        if (data.type === 'geometry' && data.positions && data.colors && data.indices) {
          this.mesh.appendGeometry(data.positions as Float32Array, data.colors as Float32Array, data.indices as Uint16Array);
        }
      };
    } catch (e) {
      this.useWorker = false;
      this.worker = undefined;
      // Fallback to main-thread path
    }
  }

  private postToWorker(msg: WorkerMsg) {
    if (!this.worker) return;
    (this.worker as any).postMessage(msg);
  }
}

export default VectorPencilTool;
