// VKTOR: Arquitectura "Triangle Strip" (Corregido con Namespace Unificado)
console.log('--- VektorApp main.ts (namespace-fix) Cargado ---');

// VKTOR: ¡CAMBIO 1! - Importación unificada. Esta es la forma más robusta.
import * as PIXI from 'pixi.js';
import './style.css';

// Registramos plugins usando el namespace
PIXI.extensions.add(PIXI.TickerPlugin);
PIXI.extensions.add(PIXI.EventSystem);

/**
 * Clase principal que inicializa el motor gráfico de Vektor.
 */
class VektorApp {
  // VKTOR: ¡CAMBIO 2! - Usamos InstanceType para TODOS los tipos de Pixi
  // Relaxed types to avoid incompatible Pixi namespace typings in this setup
  private app: any;
  private sceneContainer: any;
  private brushLayer: any;

  private isDrawing = false;
  private prevPoint: number[] | null = null; // [x, y, pressure]

  // Parámetros del pincel
  private size: number = 16;
  private segmentAlpha: number = 1.0;
  private simulatePressure: boolean = true;

  constructor() {
  this.app = new PIXI.Application();
  // Use a cast to `any` when constructing Pixi classes to avoid TS typing mismatches
  this.sceneContainer = new (PIXI as any).Container();
  this.brushLayer = new (PIXI as any).Graphics();
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

    this.app.stage.on('pointerdown', this.handlePointerDown);
    this.app.stage.on('pointermove', this.handlePointerMove);
    this.app.stage.on('pointerup', this.handlePointerUp);
    this.app.stage.on('pointerupoutside', this.handlePointerUp);

    console.log('Vektor Engine Inicializado. Modo pincel de trapecios.');
    this.setupControls();
  }
  
  /**
   * Vincula sliders/checkbox de UI.
   */
  private setupControls() {
    // ... (tu código de setupControls está perfecto) ...
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
    this.brushLayer.clear();
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
   * "Confirma" el trazo de la vista previa a la escena principal.
   * (Esta es tu lógica de "swap", que es correcta)
   */
  private handlePointerUp = () => {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.prevPoint = null;

    if (this.brushLayer.geometry.graphicsData.length === 0) {
      return;
    }

    const finalStroke = this.brushLayer;
    finalStroke.alpha = this.segmentAlpha;

    this.sceneContainer.addChild(finalStroke);

    this.brushLayer = new PIXI.Graphics();
    this.app.stage.addChild(this.brushLayer);
  };
  
  // --- Dibujo del pincel de "Trapecios" (Triangle Strip) ---

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

    // VKTOR: ¡CAMBIO 3! - Arreglo de la API de dibujo (v8)
    // Esta es la forma moderna de dibujar que elimina la advertencia.
    this.brushLayer
      .moveTo(x1, y1)
      .lineTo(x2, y2)
      .lineTo(x3, y3)
      .lineTo(x4, y4)
      .closePath()
      .fill(0xeeeeee); // El .fill() va al final
  }

  /**
   * Helper para extraer y normalizar datos del puntero.
   */
  private getPointData = (event: any /* FederatedPointerEvent | PointerEvent | MouseEvent */): number[] => {
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