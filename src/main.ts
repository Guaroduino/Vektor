// VKTOR: Arquitectura "Triangle Strip" (beginFill/endFill FIX)
console.log('--- VektorApp main.ts (beginFill-fix) Cargado ---');

import { Application, Container, Graphics } from 'pixi.js';
import './style.css';

// PixiJS v8 ya incluye los sistemas necesarios, no es necesario registrar plugins manualmente

/**
 * Clase principal que inicializa el motor gráfico de Vektor.
 */
class VektorApp {
  // Expose app for renderer info overlay
  static instance: VektorApp | null = null;
  // Types come from Pixi v8; keep annotations lightweight for TS verbatimModuleSyntax
  private app!: InstanceType<typeof Application>;
  private sceneContainer!: Container;
  private brushLayer!: Graphics;

  private isDrawing = false;
  private prevPoint: number[] | null = null; // [x, y, pressure]
  // Buffer for incoming pointer points (consumed in rAF)
  private pointBuffer: Array<{x:number,y:number,p:number,t:number}> = [];
  private needsDraw: boolean = false;
  // Simple rolling latency measurement
  private latencySamples: number[] = [];
  // Worker/offscreen canvas integration
  private strokeWorker: Worker | null = null;
  private workerActive: boolean = false;
  // Multi-touch / gesture support
  private activePointers: Map<number, {x:number,y:number}> = new Map();
  private gestureActive: boolean = false;
  private gestureBaseDistance: number = 0;
  private gestureBaseMid: {x:number,y:number} | null = null;
  private baseSceneScale: number = 1;
  private baseScenePos: {x:number,y:number} = {x:0,y:0};
  
  

  // Parámetros del pincel
  private size: number = 16;
  private segmentAlpha: number = 1.0;
  private simulatePressure: boolean = true;

  constructor() {
    this.app = new Application();
    this.sceneContainer = new Container();
    this.brushLayer = new Graphics();
    VektorApp.instance = this;
    (window as any).__PIXI_APP__ = this.app;
    this.setup();
  }

  /**
   * Configura las propiedades principales de la aplicación Pixi.
   */
  private async setup() {
    await this.app.init({
      resizeTo: window,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    document.body.appendChild(this.app.canvas as HTMLCanvasElement);

    // Create an overlay canvas that will sit above the Pixi canvas for fast worker-rendered strokes
    try {
      const baseCanvas = this.app.canvas as HTMLCanvasElement;
      const rect = baseCanvas.getBoundingClientRect();
      const overlay = document.createElement('canvas');
      overlay.style.position = 'absolute';
      overlay.style.left = rect.left + 'px';
      overlay.style.top = rect.top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '9999';
      // Backing store sized by devicePixelRatio for crispness; worker will be informed of dpr
      const dpr = window.devicePixelRatio || 1;
      overlay.width = Math.max(1, Math.round(rect.width * dpr));
      overlay.height = Math.max(1, Math.round(rect.height * dpr));
  document.body.appendChild(overlay);

      // If OffscreenCanvas transfer is available, initialize the worker and give it control of the overlay
      if (typeof (overlay as any).transferControlToOffscreen === 'function') {
        try {
          this.strokeWorker = new Worker(new URL('./stroke.worker.ts', import.meta.url), { type: 'module' });
          const off = (overlay as any).transferControlToOffscreen() as OffscreenCanvas;
          this.strokeWorker.postMessage({ type: 'init', canvas: off, width: overlay.width, height: overlay.height, dpr }, [off]);
          this.workerActive = true;
          this.strokeWorker.onmessage = (evt) => {
            // could handle worker telemetry here
            if (evt.data && evt.data.type === 'log') console.log('[stroke.worker]', evt.data.msg);
          };
          // on resize update worker
          window.addEventListener('resize', () => {
            const r = (this.app.canvas as HTMLCanvasElement).getBoundingClientRect();
            overlay.style.left = r.left + 'px';
            overlay.style.top = r.top + 'px';
            overlay.style.width = r.width + 'px';
            overlay.style.height = r.height + 'px';
            const newW = Math.max(1, Math.round(r.width * (window.devicePixelRatio || 1)));
            const newH = Math.max(1, Math.round(r.height * (window.devicePixelRatio || 1)));
            overlay.width = newW;
            overlay.height = newH;
            if (this.strokeWorker) this.strokeWorker.postMessage({ type: 'resize', width: newW, height: newH, dpr: window.devicePixelRatio });
          });
        } catch (e) {
          console.warn('Worker/offscreen unavailable, falling back to main-thread drawing');
          this.workerActive = false;
          this.strokeWorker = null;
        }
      }
    } catch (e) { /* ignore overlay setup failures */ }
    try {
      if (this.app.canvas instanceof HTMLCanvasElement) {
        (this.app.canvas as HTMLCanvasElement).style.touchAction = 'none';
        (this.app.canvas as HTMLCanvasElement).style.userSelect = 'none';
      }
    } catch (e) { /* no-op */ }

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.addChild(this.sceneContainer);
    this.app.stage.addChild(this.brushLayer);

    // .bind(this) es crucial
    this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
    this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
    this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
    this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));

  // Start the rAF consumer that draws from the point buffer once per frame
  requestAnimationFrame(this.rafLoop.bind(this));

    console.log('Vektor Engine Inicializado. Modo pincel de trapecios.');
    this.setupControls();
  }

  /**
   * Vincula sliders/checkbox de UI.
   */
  private setupControls() {
    // ... (tu código de setupControls está bien) ...
     const bindRange = (id: string, initial: number, onValue: (v: number) => void) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      const valEl = document.getElementById(id + 'Val') as HTMLElement | null;
      if (!el) return;
      el.value = String(initial);
      if (valEl) valEl.textContent = String(initial);
      const update = () => {
        const v = parseFloat(el.value);
        if (!Number.isFinite(v)) return;
        onValue(v);
        if (valEl) valEl.textContent = String(v);
      };
      el.addEventListener('input', update);
    };
    const bindCheckbox = (id: string, initial: boolean, onValue: (v: boolean) => void) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (!el) return;
      el.checked = initial;
      const update = () => onValue(el.checked);
      el.addEventListener('change', update);
    };
    bindRange('size', this.size, (v) => (this.size = Math.max(1, Math.round(v))));
    bindRange('alpha', this.segmentAlpha, (v) => {
      this.segmentAlpha = Math.min(1, Math.max(0.05, v));
      // Keep the live preview layer in sync with the selected alpha
      try {
        (this.brushLayer as any).alpha = this.segmentAlpha;
      } catch (e) { /* no-op */ }
      // Send params to worker when available
      if (this.strokeWorker) this.strokeWorker.postMessage({ type: 'params', size: this.size, alpha: this.segmentAlpha });
    });
    bindCheckbox('simulatePressure', this.simulatePressure, (v) => (this.simulatePressure = v));
  }

  // --- Manejadores de Eventos (Hilo Principal) ---

  private handlePointerDown = (event: any) => {
    const native = event.nativeEvent as PointerEvent;
    // register pointer for gesture detection
      this.activePointers.set(native.pointerId, { x: native.clientX, y: native.clientY });

    if (this.activePointers.size > 1) {
      // begin gesture (pan/zoom) mode
      this.gestureActive = true;
      this.isDrawing = false;
      // capture two first pointers
      const pts = Array.from(this.activePointers.values());
      const a = pts[0], b = pts[1];
      this.gestureBaseDistance = Math.hypot(a.x - b.x, a.y - b.y);
      this.gestureBaseMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  this.baseSceneScale = ((this.sceneContainer as any).scale && (this.sceneContainer as any).scale.x) || 1;
      this.baseScenePos = { x: (this.sceneContainer as any).x || 0, y: (this.sceneContainer as any).y || 0 };
      // stop any in-progress stroke on main thread and worker
      this.isDrawing = false;
      this.prevPoint = null;
      if (this.strokeWorker) this.strokeWorker.postMessage({ type: 'reset' });
      return;
    }

  // single pointer: begin drawing
    this.isDrawing = true;
    this.hasSegments = false;
    (this.brushLayer as any).clear?.();
    this.prevPoint = this.getPointData(event);
    // reset buffer and timing on new stroke
    this.pointBuffer.length = 0;
    this.needsDraw = true;
    // reset worker prevPoint so strokes don't connect across separate strokes
    if (this.strokeWorker) this.strokeWorker.postMessage({ type: 'reset' });
    // Ensure live preview uses the configured alpha
    try {
      (this.brushLayer as any).alpha = this.segmentAlpha;
    } catch (e) { /* no-op */ }
  };

  private handlePointerMove = (event: any) => {
  const native = event.nativeEvent as PointerEvent;
    // update active pointer position
    if (native && typeof (native as any).pointerId === 'number') {
      this.activePointers.set((native as any).pointerId, { x: native.clientX, y: native.clientY });
    }

    // If gesture active, handle pan/zoom
    if (this.gestureActive && this.activePointers.size >= 2) {
      const entries = Array.from(this.activePointers.values());
      const a = entries[0], b = entries[1];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.gestureBaseDistance > 0) {
        const scale = dist / this.gestureBaseDistance;
        const newScale = this.baseSceneScale * scale;
        // apply scale
          (this.sceneContainer as any).scale.x = newScale;
          (this.sceneContainer as any).scale.y = newScale;
        // pan based on midpoint delta (approx)
        const dx = mid.x - (this.gestureBaseMid?.x || mid.x);
        const dy = mid.y - (this.gestureBaseMid?.y || mid.y);
        (this.sceneContainer as any).x = this.baseScenePos.x + dx;
        (this.sceneContainer as any).y = this.baseScenePos.y + dy;
      }
      return;
    }

    if (!this.isDrawing) return;

  const sourceEv = event.nativeEvent as MouseEvent | PointerEvent;
    const coalescedEvents: Array<MouseEvent | PointerEvent> =
      typeof (sourceEv as any).getCoalescedEvents === 'function'
        ? ((sourceEv as any).getCoalescedEvents() as Array<PointerEvent>)
        : [sourceEv];

    // Cheap sampling thresholds - tune as needed
    const MIN_DT = 8; // ms
    const MIN_DIST2 = 0.3 * 0.3; // px^2

    for (const e of coalescedEvents) {
      const curPointArr = this.getPointData(e);
      const curPoint = { x: curPointArr[0], y: curPointArr[1], p: curPointArr[2], t: performance.now() };

      const last = (this.pointBuffer.length > 0) ? this.pointBuffer[this.pointBuffer.length - 1] : null;
      if (last) {
        const dt = curPoint.t - last.t;
        const dx = curPoint.x - last.x;
        const dy = curPoint.y - last.y;
        const dist2 = dx * dx + dy * dy;
        if (dt < MIN_DT && dist2 < MIN_DIST2) {
          // drop redundant point
          continue;
        }
      }

      this.pointBuffer.push(curPoint);
      this.needsDraw = true;
      // Keep buffer bounded to avoid unbounded memory on pathological input
      if (this.pointBuffer.length > 1024) this.pointBuffer.shift();
    }
  };

  /**
   * "Confirma" el trazo de la vista previa a la escena principal (Swap).
   */
  private handlePointerUp = () => {
    // Remove pointer from activePointers if present
    // The event passed into this handler may be federated without native pointerId — clear all singletons for safety
    this.activePointers.clear();
    // If gesture was active, finish gesture
    if (this.gestureActive) {
      this.gestureActive = false;
      return;
    }

    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.prevPoint = null;
    // notify worker to reset prevPoint to avoid connecting strokes
    if (this.strokeWorker) this.strokeWorker.postMessage({ type: 'reset' });

    if (!this.hasSegments) {
      // Nada dibujado realmente
      (this.brushLayer as any).clear?.();
      return;
    }

    // If worker is active, strokes are already rendered to the overlay canvas; avoid duplicating into the scene graph
    if (this.workerActive) {
      // reset preview layer
      (this.brushLayer as any).clear?.();
      this.brushLayer = new Graphics();
      (this.brushLayer as any).alpha = this.segmentAlpha;
      this.app.stage.addChild(this.brushLayer);
      this.hasSegments = false;
      return;
    }

    // Commit current preview (which already uses `this.segmentAlpha` as its layer alpha)
    const finalStroke = this.brushLayer;
    this.sceneContainer.addChild(finalStroke);

    // Create a fresh preview layer and keep its alpha in sync
    this.brushLayer = new Graphics();
    (this.brushLayer as any).alpha = this.segmentAlpha;
  this.app.stage.addChild(this.brushLayer);
  };

  // rAF loop: consume buffered points and draw once per frame
  private rafLoop() {
    if (this.needsDraw && this.pointBuffer.length > 0) {
      // Batch all buffered points for this frame
      const batch: Array<{x:number,y:number,p:number,t:number}> = [];
      while (this.pointBuffer.length > 0) {
        batch.push(this.pointBuffer.shift()!);
      }

      if (batch.length) {
        // record latency samples (input->consume)
        for (const pt of batch) {
          const latency = performance.now() - pt.t;
          this.latencySamples.push(latency);
          if (this.latencySamples.length > 200) this.latencySamples.shift();
        }

        if (this.workerActive && this.strokeWorker) {
          // tell the worker to draw these points; worker maintains its own prevPoint
          this.strokeWorker.postMessage({ type: 'points', points: batch });
          // mark that we have segments so pointerup behaves consistently
          if (batch.length) this.hasSegments = true;
        } else {
          // fallback: draw on main thread as before
          for (const pt of batch) {
            if (!this.prevPoint) {
              this.prevPoint = [pt.x, pt.y, pt.p];
              continue;
            }
            const next = [pt.x, pt.y, pt.p];
            this.drawTrapezoidSegment(this.prevPoint, next);
            this.prevPoint = next;
            this.hasSegments = true;
          }
        }
      }

      this.needsDraw = false;

      // Log a compact latency summary every ~500ms
      const now = performance.now();
      if (!this._lastLatencyLog || now - this._lastLatencyLog > 500) {
        this._lastLatencyLog = now;
        if (this.latencySamples.length) {
          const sum = this.latencySamples.reduce((a,b) => a+b, 0);
          const avg = sum / this.latencySamples.length;
          const p95 = this.latencySamples.slice().sort((a,b)=>a-b)[Math.floor(this.latencySamples.length*0.95)];
          console.log(`stroke latency avg=${avg.toFixed(1)}ms p95=${(p95||avg).toFixed(1)}ms samples=${this.latencySamples.length}`);
        }
      }
    }
    requestAnimationFrame(this.rafLoop.bind(this));
  }

  private _lastLatencyLog: number | null = null;

  // --- Dibujo del pincel de "Trapecios" (Triangle Strip) ---

  private hasSegments = false;

  private drawTrapezoidSegment(a: number[], b: number[]) {
    const ax = a[0], ay = a[1], ap = this.simulatePressure ? a[2] ?? 0.5 : 1.0;
    const bx = b[0], by = b[1], bp = this.simulatePressure ? b[2] ?? 0.5 : 1.0;

    let dx = bx - ax;
    let dy = by - ay;
    let dist = Math.hypot(dx, dy);

    if (dist < 0.001) return;

    const px = -dy / dist;
    const py = dx / dist;

    const aWidth = (this.size * ap) * 0.5;
    const bWidth = (this.size * bp) * 0.5;

    const x1 = ax + px * aWidth;
    const y1 = ay + py * aWidth;
    const x2 = ax - px * aWidth;
    const y2 = ay - py * aWidth;
    const x3 = bx - px * bWidth;
    const y3 = by - py * bWidth;
    const x4 = bx + px * bWidth;
    const y4 = by + py * bWidth;

    // Usar la API moderna de v8: moveTo/lineTo/closePath + fill
  (this.brushLayer as any).moveTo?.(x1, y1);
  (this.brushLayer as any).lineTo?.(x2, y2);
  (this.brushLayer as any).lineTo?.(x3, y3);
  (this.brushLayer as any).lineTo?.(x4, y4);
  (this.brushLayer as any).closePath?.();
  (this.brushLayer as any).fill?.({ color: 0xeeeeee, alpha: 1 });
    this.hasSegments = true;
  }

  /**
   * Helper para extraer y normalizar datos del puntero.
   */
  private getPointData = (event: any): number[] => {
      let x: number, y: number;
      let pressure: number;

      // Prefer Pixi federated event coordinates when available
      if (event && event.global && typeof event.global.x === 'number') {
        const ev = event;
        x = ev.global.x;
        y = ev.global.y;
        pressure = (ev.pressure ?? 0.5) as number;
      } else {
        // Fallback: map native PointerEvent/MouseEvent clientX/clientY to canvas coordinates
        const native = event as PointerEvent | MouseEvent;
        const canvas = this.app.canvas as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const clientX = (native as PointerEvent).clientX ?? (native as MouseEvent).clientX ?? 0;
        const clientY = (native as PointerEvent).clientY ?? (native as MouseEvent).clientY ?? 0;
  // Map client coordinates into Pixi's logical renderer coordinates (screen space).
  // When using `autoDensity` and `resolution > 1`, the canvas backing store
  // (`canvas.width/height`) is larger than the CSS size. Pixi display
  // coordinates (and `event.global`) are expressed in logical screen
  // coordinates (not backing pixels), so we should scale using
  // `this.app.screen` to remain consistent.
  const scaleX = (this.app.screen.width) / Math.max(1, rect.width);
  const scaleY = (this.app.screen.height) / Math.max(1, rect.height);
  x = (clientX - rect.left) * scaleX;
  y = (clientY - rect.top) * scaleY;
        pressure = (native instanceof PointerEvent && typeof native.pressure === 'number') ? native.pressure : 0.5;
      }

      return [x, y, pressure];
  };

} // End of VektorApp class

// Iniciar la aplicación
new VektorApp();