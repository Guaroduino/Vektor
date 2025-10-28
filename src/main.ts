// VKTOR: vista previa estable sin artefactos
console.log('--- VektorApp main.ts (preview-graphics) Cargado ---');

import {
  Application,
  Graphics,
  TickerPlugin,
  EventSystem,
  extensions
} from 'pixi.js';

import { getStroke } from 'perfect-freehand';
import './style.css';

// Registramos plugins
extensions.add(TickerPlugin);
extensions.add(EventSystem);

/**
 * Clase principal que inicializa el motor gráfico de Vektor.
 */
class VektorApp {
  private app: any;
  private worker: Worker;

  private sceneContainer: any;
  private livePreviewContainer: any;

  private isDrawing = false;
  private currentStrokePoints: number[][] = [];
  private currentStrokeFallback: any;
  private activeStrokeContainer: any | null = null;
  private lastCommittedIndex: number = 0;
  private segmentLength: number = 24; // puntos por segmento
  private overlapPoints: number = 8;  // superposición para evitar huecos
  private segmentAlpha: number = 1.0; // usa <1.0 para acumulación futura
  // Parámetros de perfect-freehand
  private size: number = 16;
  private thinning: number = 0.7;
  private smoothing: number = 0.5;
  private streamline: number = 0.5;
  private simulatePressure: boolean = true;

  private pendingFrame: boolean = false;
  private slowIndicatorGraphic: any;

  private RDP_EPS_BASE = 0.5;

  constructor() {
    this.app = new Application();
    
    this.worker = new Worker(new URL('./stroke.worker.ts', import.meta.url), {
      type: 'module'
    });
    this.worker.onmessage = this.handleWorkerMessage.bind(this); // .bind() es crucial

  this.sceneContainer = new Graphics();
  this.livePreviewContainer = new Graphics();
    
    this.currentStrokeFallback = new Graphics();
    this.livePreviewContainer.addChild(this.currentStrokeFallback);

    this.slowIndicatorGraphic = new Graphics();
    this.slowIndicatorGraphic.visible = false;

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

    document.body.appendChild(this.app.view as HTMLCanvasElement);

    try {
      if (this.app.view instanceof HTMLCanvasElement) {
        (this.app.view as HTMLCanvasElement).style.touchAction = 'none';
        (this.app.view as HTMLCanvasElement).style.userSelect = 'none';
      }
    } catch (e) { /* no-op */ }

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.addChild(this.sceneContainer);
    this.app.stage.addChild(this.livePreviewContainer);
    this.app.stage.addChild(this.slowIndicatorGraphic);

    // ... (listeners de eventos) ...
    this.app.stage.on('pointerdown', this.handlePointerDown);
    this.app.stage.on('pointermove', this.handlePointerMove);
    this.app.stage.on('pointerup', this.handlePointerUp);
    this.app.stage.on('pointerupoutside', this.handlePointerUp);

  console.log('Vektor Engine Inicializado. Pipeline de dibujo listo (con Worker).');
  this.setupControls();
    
    // ... (listeners de teclado) ...
    window.addEventListener('keydown', (e) => {
      if (e.key === ',') {
        this.RDP_EPS_BASE = Math.max(0.1, this.RDP_EPS_BASE - 0.1);
        console.log('RDP_EPS_BASE ->', this.RDP_EPS_BASE.toFixed(2));
      } else if (e.key === '.') {
        this.RDP_EPS_BASE = this.RDP_EPS_BASE + 0.1;
        console.log('RDP_EPS_BASE ->', this.RDP_EPS_BASE.toFixed(2));
      }
    });
  }
  
  /**
   * Vincula sliders/checkbox de UI con parámetros internos.
   */
  private setupControls() {
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
    bindRange('thinning', this.thinning, (v) => (this.thinning = Math.min(1, Math.max(0, v))));
    bindRange('smoothing', this.smoothing, (v) => (this.smoothing = Math.min(1, Math.max(0, v))));
    bindRange('streamline', this.streamline, (v) => (this.streamline = Math.min(1, Math.max(0, v))));

    bindRange('segmentLength', this.segmentLength, (v) => (this.segmentLength = Math.max(4, Math.round(v))));
    bindRange('overlap', this.overlapPoints, (v) => (this.overlapPoints = Math.max(0, Math.round(v))));
    bindRange('alpha', this.segmentAlpha, (v) => (this.segmentAlpha = Math.min(1, Math.max(0.05, v))));

    bindCheckbox('simulatePressure', this.simulatePressure, (v) => (this.simulatePressure = v));
  }

  // --- Manejadores de Eventos (Hilo Principal) ---

  private handlePointerDown = (event: any) => {
    this.isDrawing = true;
    this.currentStrokePoints = [];
    this.lastCommittedIndex = 0;
    // Crear contenedor para el trazo activo
    this.activeStrokeContainer = new Graphics();
    this.sceneContainer.addChild(this.activeStrokeContainer);
    const point = this.getPointData(event);
    this.currentStrokePoints.push(point);
    this.clearLivePreview();
  };

  private handlePointerMove = (event: any) => {
    if (!this.isDrawing) return;
    const nativeEv = event.nativeEvent as MouseEvent | PointerEvent;
    const coalescedEvents: Array<MouseEvent | PointerEvent> =
      typeof (nativeEv as any).getCoalescedEvents === 'function'
        ? ((nativeEv as any).getCoalescedEvents() as Array<PointerEvent>)
        : [nativeEv];
    for (const e of coalescedEvents) {
      const point = this.getPointData(e);
      this.currentStrokePoints.push(point);
    }
    // Comprometer segmento si hay puntos suficientes
    const nextThreshold = this.lastCommittedIndex + this.segmentLength;
    if (this.currentStrokePoints.length >= nextThreshold) {
      const start = Math.max(0, this.lastCommittedIndex - this.overlapPoints);
      const end = nextThreshold;
      const chunk = this.currentStrokePoints.slice(start, end);
      const segOptions = {
        size: this.size,
        thinning: this.thinning,
        smoothing: this.smoothing,
        streamline: this.streamline,
        simulatePressure: this.simulatePressure
      } as const;
      this.worker.postMessage({
        type: 'segment',
        points: chunk,
        options: segOptions,
        rdpEpsilon: this.RDP_EPS_BASE * (window.devicePixelRatio || 1)
      });
      // Avanzamos el índice conservando overlap
      this.lastCommittedIndex = end - this.overlapPoints;
    }
    this.scheduleRenderLiveStroke();
  };

  private handlePointerUp = () => {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    // Enviar el tramo final
    if (this.currentStrokePoints.length > Math.max(1, this.lastCommittedIndex + 1)) {
      const start = Math.max(0, this.lastCommittedIndex - this.overlapPoints);
      const chunk = this.currentStrokePoints.slice(start);
      this.finalizeStroke(chunk);
    }
    this.clearLivePreview();
    // No limpiamos activeStrokeContainer; queda en la escena como trazo final
    this.activeStrokeContainer = null;
  };

  private clearLivePreview() {
    this.currentStrokeFallback.clear();
  }

  // --- Lógica de Renderizado (Hilo Principal) ---

  private scheduleRenderLiveStroke = () => {
    if (this.pendingFrame) return;
    this.pendingFrame = true;
    window.requestAnimationFrame(() => {
      this.pendingFrame = false;
      this.renderLiveStroke();
    });
  };

  /**
   * Renderiza la VISTA PREVIA en vivo. (Hot Path)
   */
  private renderLiveStroke() {
    // Opciones de perfect-freehand (coherentes con el worker) desde la UI
    const options = {
      size: this.size,
      thinning: this.thinning,
      smoothing: this.smoothing,
      streamline: this.streamline,
      simulatePressure: this.simulatePressure
    } as const;

    // Solo previsualizamos la "cola" para no duplicar lo ya comprometido
    const previewStart = Math.max(0, this.lastCommittedIndex - this.overlapPoints);
    const previewPoints = this.currentStrokePoints.slice(previewStart);
    const strokePolygonPoints = getStroke(previewPoints, options);
    this.currentStrokeFallback.clear();
    if (strokePolygonPoints.length === 0) return;
    this.currentStrokeFallback.beginFill(0xeeeeee);
    // drawPolygon acepta un array plano [x1,y1,x2,y2,...]
    this.currentStrokeFallback.drawPolygon(strokePolygonPoints.flat());
    this.currentStrokeFallback.endFill();
  }

  /**
   * Envía el trazo al Worker para su finalización. (Cold Path)
   */
  private finalizeStroke(chunk: number[][]) {
    if (this.slowIndicatorGraphic) {
        this.slowIndicatorGraphic.visible = true;
    }
    const options = {
      size: this.size,
      thinning: this.thinning,
      smoothing: this.smoothing,
      streamline: this.streamline,
      simulatePressure: this.simulatePressure
    } as const;
    this.worker.postMessage({
      type: 'finalize',
      points: chunk,
      options,
      rdpEpsilon: this.RDP_EPS_BASE * (window.devicePixelRatio || 1)
    });
    this.currentStrokePoints = [];
  }

  /**
   * Recibe los segmentos renderizados del Worker.
   */
  private handleWorkerMessage = (event: MessageEvent) => {
    if (this.slowIndicatorGraphic) {
      this.slowIndicatorGraphic.visible = false;
    }
    const { type, segments } = event.data as { type: string; segments: any[] };
    if (type !== 'finalizeComplete' || !segments || segments.length === 0) {
      // Aceptamos también segmentos incrementales
      if (type !== 'segmentComplete' || !segments || segments.length === 0) return;
    }

    // Determinar el contenedor donde dibujar
    const targetContainer = (type === 'segmentComplete' && this.activeStrokeContainer)
      ? this.activeStrokeContainer
      : new Graphics();
    if (type !== 'segmentComplete') {
      // Si es un finalize tardío (por seguridad) añadimos a escena
      this.sceneContainer.addChild(targetContainer);
    }

    for (const polygon of segments) {
      const segmentGraphic = new Graphics();
      // Render final por segmento; base para acumulación futura
      segmentGraphic.alpha = this.segmentAlpha;
      segmentGraphic.blendMode = 'normal';

      const outerRing = polygon[0];
      if (!outerRing || outerRing.length === 0) continue;

      segmentGraphic.beginFill(0xeeeeee); // Tinta blanca/clara
      // ... (tu código de drawPolygon con beginHole/endHole) ...
      segmentGraphic.moveTo(outerRing[0][0], outerRing[0][1]);
      for (let i = 1; i < outerRing.length; i++) {
        segmentGraphic.lineTo(outerRing[i][0], outerRing[i][1]);
      }
      segmentGraphic.closePath();
      if (polygon.length > 1) {
        for (let h = 1; h < polygon.length; h++) {
          const holeRing = polygon[h];
          if (typeof (segmentGraphic as any).beginHole === 'function') {
            (segmentGraphic as any).beginHole();
            segmentGraphic.moveTo(holeRing[0][0], holeRing[0][1]);
            for (let i = 1; i < holeRing.length; i++) {
              segmentGraphic.lineTo(holeRing[i][0], holeRing[i][1]);
            }
            segmentGraphic.closePath();
            (segmentGraphic as any).endHole();
          }
        }
      }
      segmentGraphic.endFill();
      
      targetContainer.addChild(segmentGraphic);
    }
    // Nada más que hacer; en modo incremental, el contenedor activo ya está en escena
  };

  /**
   * Helper rdpSimplify (solo para la vista previa en vivo).
   */
  // rdpSimplify eliminado de la vista previa (ya no se usa aquí)

  // Eliminado: previsualización con Mesh; usamos Graphics para evitar artefactos en uniones

  /**
   * Helper para extraer y normalizar datos del puntero.
   */
  private getPointData = (event: any): number[] => {
    // ... (Tu código getPointData. Es correcto.) ...
    let x: number, y: number;
    let pressure: number;
    if ('global' in event) {
      x = event.global.x;
      y = event.global.y;
      pressure = event.pressure ?? 0.5;
    } else {
      x = event.x;
      y = event.y;
      pressure = (event instanceof PointerEvent) ? event.pressure : 0.5;
    }
    return [x, y, pressure];
  };
}

// Iniciar la aplicación
new VektorApp();