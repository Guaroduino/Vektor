// VKTOR: "Drop Segments" with Shared Vertices
console.log('--- VektorApp main.ts (shared-vertices) Cargado ---');

import { Application, Container, Graphics, FederatedPointerEvent } from 'pixi.js';
import './style.css';

// PixiJS v8 automatically includes necessary systems

/**
 * Clase principal que inicializa el motor gráfico de Vektor.
 */
class VektorApp {
  private app: InstanceType<typeof Application>;
  private sceneContainer: InstanceType<typeof Container>;

  private isDrawing = false;
  private pointHistory: Array<number[]> = []; // Historial para suavizado/bisectriz
  // VKTOR: Variables para recordar los vértices del punto anterior
  private prevLeftPoint: [number, number] | null = null;
  private prevRightPoint: [number, number] | null = null;

  // Parámetros del pincel
  private size: number = 16;
  private segmentAlpha: number = 0.1;
  private simulatePressure: boolean = true;

  constructor() {
    this.app = new Application();
    this.sceneContainer = new Container();
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

    // .bind(this) es crucial
    this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
    this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
    this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
    this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));

    console.log('Vektor Engine Inicializado. Modo "Shared Vertices".');
    this.setupControls();
  }

  /**
   * Vincula sliders/checkbox de UI.
   */
  private setupControls() {
    const bindRange = (id: string, initial: number, onValue: (v: number) => void, step?: number) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      const valEl = document.getElementById(id + 'Val') as HTMLElement | null;
      if (!el) return;
      el.value = String(initial);
      if (step) el.step = String(step);
      if (valEl) valEl.textContent = String(initial.toFixed(step ? 2 : 0));
      const update = () => {
        const v = parseFloat(el.value);
        if (!Number.isFinite(v)) return;
        onValue(v);
        if (valEl) valEl.textContent = String(v.toFixed(step ? 2 : 0));
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
    bindRange('alpha', this.segmentAlpha, (v) => (this.segmentAlpha = Math.min(1, Math.max(0.01, v))), 0.01);
    bindCheckbox('simulatePressure', this.simulatePressure, (v) => (this.simulatePressure = v));
  }

  // --- Manejadores de Eventos (Hilo Principal) ---

  private handlePointerDown = (event: InstanceType<typeof FederatedPointerEvent>) => {
    this.isDrawing = true;
    this.pointHistory = []; // Limpiamos historial
    // VKTOR: Reseteamos los vértices previos
    this.prevLeftPoint = null;
    this.prevRightPoint = null;

    const firstPoint = this.getPointData(event);
    this.pointHistory.push(firstPoint);
    // Opcional: dibujar un punto/círculo inicial si lo deseamos
  };

  private handlePointerMove = (event: InstanceType<typeof FederatedPointerEvent>) => {
    if (!this.isDrawing) return;

    const nativeEv = event.nativeEvent as MouseEvent | PointerEvent;
    const coalescedEvents: Array<MouseEvent | PointerEvent> =
      typeof (nativeEv as any).getCoalescedEvents === 'function'
        ? ((nativeEv as any).getCoalescedEvents() as Array<PointerEvent>)
        : [nativeEv];

    for (const e of coalescedEvents) {
      const curPoint = this.getPointData(e);
      this.pointHistory.push(curPoint);

      if (this.pointHistory.length > 3) {
        this.pointHistory.shift();
      }

      // Necesitamos al menos 2 puntos (A, B) para dibujar un segmento
      if (this.pointHistory.length >= 2) {
        // Obtenemos los puntos A y B (B es el punto actual donde calcularemos vértices)
        const bIndex = this.pointHistory.length - 1;
        const aIndex = bIndex - 1;
        const a = this.pointHistory[aIndex];
        const b = this.pointHistory[bIndex];

        // Calculamos el perpendicular y los vértices para el punto B
        const [px, py] = this.calculatePerpendicular(a, b);
        const bp = this.simulatePressure ? b[2] ?? 0.5 : 1.0;
        const bWidth = (this.size * bp) * 0.5;
        const curL: [number, number] = [b[0] + px * bWidth, b[1] + py * bWidth]; // B Left
        const curR: [number, number] = [b[0] - px * bWidth, b[1] - py * bWidth]; // B Right

        // Si tenemos vértices previos (A Left, A Right), dibujamos el segmento
        if (this.prevLeftPoint && this.prevRightPoint) {
          this.drawConnectingSegment(this.prevLeftPoint, this.prevRightPoint, curL, curR);
        }

        // VKTOR: Actualizamos los vértices previos para la siguiente iteración
        this.prevLeftPoint = curL;
        this.prevRightPoint = curR;
      }
    }
  };

  private handlePointerUp = () => {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.pointHistory = [];
    // VKTOR: Reseteamos vértices previos al finalizar
    this.prevLeftPoint = null;
    this.prevRightPoint = null;
  };

  // --- Lógica de Cálculo y Dibujo ---

  /**
   * Calcula el vector perpendicular normalizado en el punto B.
   * Usa bisectriz si hay 3 puntos en historial, sino normal simple A->B.
   * Devuelve [px, py]
   */
  private calculatePerpendicular(a: number[], b: number[]): [number, number] {
    let px: number, py: number;

    if (this.pointHistory.length === 3) {
      // Usamos la bisectriz A-B-C (B es el punto actual)
      const p_a = this.pointHistory[0]; // Corresponde a A
      // const p_b = this.pointHistory[1]; // Corresponde a B
      const p_c = this.pointHistory[2]; // El punto 'siguiente' a B

      // Vector p_a -> p_b (equivalente a A->B)
      let ab_dx = b[0] - p_a[0];
      let ab_dy = b[1] - p_a[1];
      let ab_dist = Math.hypot(ab_dx, ab_dy) || 1;
      const ab_nx = ab_dx / ab_dist;
      const ab_ny = ab_dy / ab_dist;

      // Vector p_b -> p_c (equivalente a B->C)
      let bc_dx = p_c[0] - b[0];
      let bc_dy = p_c[1] - b[1];
      let bc_dist = Math.hypot(bc_dx, bc_dy) || 1;
      const bc_nx = bc_dx / bc_dist;
      const bc_ny = bc_dy / bc_dist;

      // Vector Bisectriz
      let bis_x = ab_nx + bc_nx;
      let bis_y = ab_ny + bc_ny;
      let bis_dist = Math.hypot(bis_x, bis_y);

      if (bis_dist < 0.001) { // Fallback si son opuestos
        px = -ab_ny;
        py = ab_nx;
      } else {
        px = -bis_y / bis_dist; // Perpendicular a la bisectriz
        py = bis_x / bis_dist;
      }
    } else {
      // Inicio del trazo (solo A y B): Usamos la normal simple A->B
      let dx = b[0] - a[0];
      let dy = b[1] - a[1];
      let dist = Math.hypot(dx, dy);
      if (dist < 0.001) {
          // Si A y B son iguales, no podemos calcular normal. Usamos un valor por defecto (ej. vertical)
          px = 1; py = 0;
      } else {
          px = -dy / dist;
          py = dx / dist;
      }
    }
    return [px, py];
  }


  /**
   * Dibuja los dos triángulos que conectan los vértices previos (AL, AR)
   * con los vértices actuales (BL, BR) y los añade a sceneContainer.
   */
  private drawConnectingSegment(
    AL: [number, number], AR: [number, number],
    BL: [number, number], BR: [number, number]
  ) {
    const segment = new Graphics();
    segment.alpha = this.segmentAlpha;
    segment.blendMode = 'add';

    segment.beginFill(0xeeeeee);
    // Triángulo 1: AL, AR, BL
    segment.moveTo(AL[0], AL[1]);
    segment.lineTo(AR[0], AR[1]);
    segment.lineTo(BL[0], BL[1]);
    segment.closePath();
    // Triángulo 2: AR, BR, BL
    segment.moveTo(AR[0], AR[1]);
    segment.lineTo(BR[0], BR[1]);
    segment.lineTo(BL[0], BL[1]);
    segment.closePath();
    segment.endFill();

    this.sceneContainer.addChild(segment);
  }

  /**
   * Helper para extraer y normalizar datos del puntero.
   */
  private getPointData = (event: InstanceType<typeof FederatedPointerEvent> | PointerEvent | MouseEvent): number[] => {
      let x: number, y: number;
      let pressure: number;
      if ('global' in event && event.global) {
          x = event.global.x;
          y = event.global.y;
          pressure = event.pressure ?? 0.5;
      } else if ('x' in event && 'y' in event) {
          x = event.x;
          y = event.y;
          pressure = (event instanceof PointerEvent) ? (event.pressure ?? 0.5) : 0.5;
      } else {
          console.warn("Unexpected event structure in getPointData:", event);
          x = 0; y = 0; pressure = 0.5;
      }
      return [x, y, pressure];
  };

} // End of VektorApp class

// Iniciar la aplicación
new VektorApp();