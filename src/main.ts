// VKTOR: vista previa estable sin artefactos
console.log('--- VektorApp main.ts (triangle-brush) Cargado ---');

import {
  Application,
  Graphics,
  TickerPlugin,
  EventSystem,
  extensions
} from 'pixi.js';

import './style.css';

// Registramos plugins
extensions.add(TickerPlugin);
extensions.add(EventSystem);

/**
 * Clase principal que inicializa el motor gráfico de Vektor.
 */
class VektorApp {
  private app: any;
  private sceneContainer: any;
  private brushLayer: any;

  private isDrawing = false;
  private prevPoint: number[] | null = null; // [x, y, pressure]
  private carryDistance: number = 0;        // acumulador para espaciar triángulos

  // Parámetros del pincel de triángulos
  private size: number = 16;              // tamaño base del triángulo
  private segmentAlpha: number = 1.0;     // opacidad de las figuras dibujadas
  private simulatePressure: boolean = true; // usar presión real del stylus

  constructor() {
    this.app = new Application();

    this.sceneContainer = new Graphics();
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
    this.app.stage.addChild(this.brushLayer);

    this.app.stage.on('pointerdown', this.handlePointerDown);
    this.app.stage.on('pointermove', this.handlePointerMove);
    this.app.stage.on('pointerup', this.handlePointerUp);
    this.app.stage.on('pointerupoutside', this.handlePointerUp);

    console.log('Vektor Engine Inicializado. Modo pincel de triángulos.');
    this.setupControls();
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
    bindRange('alpha', this.segmentAlpha, (v) => (this.segmentAlpha = Math.min(1, Math.max(0.05, v))));
    bindCheckbox('simulatePressure', this.simulatePressure, (v) => (this.simulatePressure = v));

    // reflejar la opacidad en la capa de pincel
    const applyAlpha = () => {
      this.brushLayer.alpha = this.segmentAlpha;
    };
    applyAlpha();
    const alphaEl = document.getElementById('alpha') as HTMLInputElement | null;
    if (alphaEl) alphaEl.addEventListener('input', applyAlpha);
  }

  // --- Manejadores de Eventos (Hilo Principal) ---

  private handlePointerDown = (event: any) => {
    this.isDrawing = true;
    this.prevPoint = this.getPointData(event);
    this.carryDistance = 0;
  };

  private handlePointerMove = (event: any) => {
    if (!this.isDrawing) return;
    const nativeEv = event.nativeEvent as MouseEvent | PointerEvent;
    const coalescedEvents: Array<MouseEvent | PointerEvent> =
      typeof (nativeEv as any).getCoalescedEvents === 'function'
        ? ((nativeEv as any).getCoalescedEvents() as Array<PointerEvent>)
        : [nativeEv];
    for (const e of coalescedEvents) {
      const cur = this.getPointData(e);
      if (!this.prevPoint) {
        this.prevPoint = cur;
        continue;
      }
      this.drawTrianglesBetween(this.prevPoint, cur);
      this.prevPoint = cur;
    }
  };

  private handlePointerUp = () => {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.prevPoint = null;
    this.carryDistance = 0;
  };
  // --- Dibujo del pincel de triángulos ---

  private drawTrianglesBetween(a: number[], b: number[]) {
    const ax = a[0], ay = a[1], ap = this.simulatePressure ? a[2] ?? 0.5 : 1.0;
    const bx = b[0], by = b[1], bp = this.simulatePressure ? b[2] ?? 0.5 : 1.0;
    let dx = bx - ax;
    let dy = by - ay;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;

    // dirección normalizada
    let nx = dx / dist;
    let ny = dy / dist;

    // espaciar triángulos a un paso basado en tamaño base
    const step = Math.max(2, this.size * 0.6);
    let t = this.carryDistance; // avance acumulado desde el último segmento

    while (t <= dist) {
      const px = ax + nx * t;
      const py = ay + ny * t;
      const lerp = t / dist;
      const press = ap + (bp - ap) * lerp;
      this.drawTriangle(px, py, nx, ny, press, dist);
      t += step;
    }

    // guardar la distancia sobrante para el próximo segmento
    this.carryDistance = t - dist;
  }

  private drawTriangle(cx: number, cy: number, nx: number, ny: number, pressure: number, segDist: number) {
    // tamaño influido por "velocidad" (distancia entre muestras) y presión
    const speedFactor = Math.max(0, Math.min(1, segDist / 20)); // 0..1 aprox
    const pressFactor = this.simulatePressure ? (0.6 + 1.0 * pressure) : 1.0; // 0.6..1.6
    const length = Math.max(3, this.size * (0.7 + 0.8 * speedFactor) * pressFactor);
    const width = Math.max(2, length * 0.6);

    // centro de la base va hacia atrás de la punta
    const bx = cx - nx * length;
    const by = cy - ny * length;
    // vector perpendicular
    const px = -ny;
    const py = nx;
    const halfW = width * 0.5;

    const x1 = cx;
    const y1 = cy; // punta
    const x2 = bx + px * halfW;
    const y2 = by + py * halfW;
    const x3 = bx - px * halfW;
    const y3 = by - py * halfW;

    this.brushLayer.beginFill(0xeeeeee);
    this.brushLayer.moveTo(x1, y1);
    this.brushLayer.lineTo(x2, y2);
    this.brushLayer.lineTo(x3, y3);
    this.brushLayer.closePath();
    this.brushLayer.endFill();
  }

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