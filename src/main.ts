// VKTOR: Arquitectura "Triangle Strip" (beginFill/endFill FIX)
console.log('--- VektorApp main.ts (beginFill-fix) Cargado ---');

import { Application, Container, Graphics } from 'pixi.js';
import './style.css';

// PixiJS v8 ya incluye los sistemas necesarios, no es necesario registrar plugins manualmente

/**
 * Clase principal que inicializa el motor gráfico de Vektor.
 */
class VektorApp {
  // Types come from Pixi v8; keep annotations lightweight for TS verbatimModuleSyntax
  private app!: InstanceType<typeof Application>;
  private sceneContainer!: Container;
  private brushLayer!: Graphics;

  private isDrawing = false;
  private prevPoint: number[] | null = null; // [x, y, pressure]

  // Parámetros del pincel
  private size: number = 16;
  private segmentAlpha: number = 1.0;
  private simulatePressure: boolean = true;

  constructor() {
    this.app = new Application();
    this.sceneContainer = new Container();
    this.brushLayer = new Graphics();
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
    bindRange('alpha', this.segmentAlpha, (v) => (this.segmentAlpha = Math.min(1, Math.max(0.05, v))));
    bindCheckbox('simulatePressure', this.simulatePressure, (v) => (this.simulatePressure = v));
  }

  // --- Manejadores de Eventos (Hilo Principal) ---

  private handlePointerDown = (event: any) => {
    this.isDrawing = true;
  this.hasSegments = false;
  (this.brushLayer as any).clear?.();
    this.prevPoint = this.getPointData(event);
  };

  private handlePointerMove = (event: any) => {
    if (!this.isDrawing) return;

    const nativeEv = event.nativeEvent as MouseEvent | PointerEvent;
    const coalescedEvents: Array<MouseEvent | PointerEvent> =
      typeof (nativeEv as any).getCoalescedEvents === 'function'
        ? ((nativeEv as any).getCoalescedEvents() as Array<PointerEvent>)
        : [nativeEv];

    for (const e of coalescedEvents) {
      const curPoint = this.getPointData(e);
      if (!this.prevPoint) {
        this.prevPoint = curPoint;
        continue;
      }
      this.drawTrapezoidSegment(this.prevPoint, curPoint);
      this.prevPoint = curPoint;
    }
  };

  /**
   * "Confirma" el trazo de la vista previa a la escena principal (Swap).
   */
  private handlePointerUp = () => {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.prevPoint = null;

    if (!this.hasSegments) {
      // Nada dibujado realmente
  (this.brushLayer as any).clear?.();
      return;
    }

  const finalStroke = this.brushLayer;
  (finalStroke as any).alpha = this.segmentAlpha;

    this.sceneContainer.addChild(finalStroke);

    this.brushLayer = new Graphics();
    this.app.stage.addChild(this.brushLayer);
  };

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

      // Improved checks for event properties
    if (event && event.global) {
      const ev = event;
      x = ev.global.x;
      y = ev.global.y;
      pressure = ev.pressure ?? 0.5;
      } else if ('x' in event && 'y' in event) {
          x = event.x;
          y = event.y;
          pressure = (event instanceof PointerEvent) ? (event.pressure ?? 0.5) : 0.5;
      } else {
          console.warn("Unexpected event structure in getPointData:", event);
          x = 0; y = 0; pressure = 0.5; // Default values
      }

      return [x, y, pressure];
  };

} // End of VektorApp class

// Iniciar la aplicación
new VektorApp();