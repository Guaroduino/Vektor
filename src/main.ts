// VKTOR: VERSIÓN extensions.add()_FIX
console.log('--- VektorApp main.ts (v.EXTENSIONS_FIX) Cargado ---');

import * as PIXI from 'pixi.js';
// we rely on runtime namespace `PIXI` and use InstanceType<typeof PIXI.*> for typing.
import { getStroke } from 'perfect-freehand';
import './style.css';
import clipping from 'polygon-clipping';

// VKTOR: ¡LA SOLUCIÓN REAL v3!
// Registramos los plugins usando 'extensions.add()'
// Esto le dice a Vite que son necesarios.
PIXI.extensions.add(PIXI.TickerPlugin);
PIXI.extensions.add(PIXI.EventSystem);

/**
 * Clase principal que inicializa el motor gráfico de Vektor.
 */
class VektorApp {
  private app: InstanceType<typeof PIXI.Application>;

  // VKTOR: Estado del dibujo
  private isDrawing = false;
  private currentStrokePoints: number[][] = []; // Almacena [x, y, pressure]
  private currentStrokeGraphic: InstanceType<typeof PIXI.Graphics>; // Gráfico de Pixi para el trazo EN VIVO
  // Tunables (se pueden ajustar en runtime con teclas):
  private POINTS_THRESHOLD = 120;
  private RDP_EPS_BASE = 0.5; // epsilon base para simplificación RDP

  constructor() {
  this.app = new PIXI.Application();
  this.currentStrokeGraphic = new PIXI.Graphics();
    this.setup();
  }

  /**
   * Configura las propiedades principales de la aplicación Pixi.
   */
  private async setup() {
    // VKTOR: Opciones de inicialización (limpias)
  await this.app.init({
      resizeTo: window,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    document.body.appendChild(this.app.view);

    // Evitar gestos táctiles del navegador
    try {
      if (this.app.view instanceof HTMLCanvasElement) {
        this.app.view.style.touchAction = 'none';
        this.app.view.style.userSelect = 'none';
      }
    } catch (e) {
      /* no-op */
    }

  // VKTOR: El escenario debe ser interactivo (Pixi v8)
  // En v8 se usa eventMode y un hitArea para recibir eventos en toda la pantalla
  this.app.stage.eventMode = 'static';
  this.app.stage.hitArea = this.app.screen;

      // VKTOR: Añadimos el gráfico del trazo actual al escenario
      this.app.stage.addChild(this.currentStrokeGraphic);

    // VKTOR: Conectar los manejadores de eventos
  this.app.stage.on('pointerdown', this.handlePointerDown);
  this.app.stage.on('pointermove', this.handlePointerMove);
  this.app.stage.on('pointerup', this.handlePointerUp);
  this.app.stage.on('pointerupoutside', this.handlePointerUp);

    // VKTOR: Ya NO necesitamos 'this.app.ticker.start();'
    // El TickerPlugin que registramos se encarga de esto automáticamente.

    console.log('Vektor Engine Inicializado. Pipeline de dibujo listo.');

    // Atajos para ajustar umbrales en tiempo real: '[' y ']' para threshold, ',' y '.' para epsilon
    window.addEventListener('keydown', (e) => {
      if (e.key === '[') {
        this.POINTS_THRESHOLD = Math.max(10, this.POINTS_THRESHOLD - 10);
        console.log('POINTS_THRESHOLD ->', this.POINTS_THRESHOLD);
      } else if (e.key === ']') {
        this.POINTS_THRESHOLD += 10;
        console.log('POINTS_THRESHOLD ->', this.POINTS_THRESHOLD);
      } else if (e.key === ',') {
        this.RDP_EPS_BASE = Math.max(0.1, this.RDP_EPS_BASE - 0.1);
        console.log('RDP_EPS_BASE ->', this.RDP_EPS_BASE.toFixed(2));
      } else if (e.key === '.') {
        this.RDP_EPS_BASE = this.RDP_EPS_BASE + 0.1;
        console.log('RDP_EPS_BASE ->', this.RDP_EPS_BASE.toFixed(2));
      }
    });
  }

  // --- Manejadores de Eventos (Event Handlers) ---

  /**
   * Se dispara cuando el usuario presiona el puntero.
   */
  private handlePointerDown = (event: any) => {
    console.log('--- POINTER DOWN ---'); // <-- DEBE APARECER
    this.isDrawing = true;
    this.currentStrokePoints = [];
    const point = this.getPointData(event);
    this.currentStrokePoints.push(point);
  };

  /**
   * Se dispara cuando el usuario mueve el puntero.
   */
  private handlePointerMove = (event: any) => {
    if (!this.isDrawing) return;
    // console.log('--- POINTER MOVE ---'); // Descomentar para logs ruidosos

  const nativeEv = event.nativeEvent as MouseEvent | PointerEvent;
    const coalescedEvents: Array<MouseEvent | PointerEvent> =
      typeof (nativeEv as any).getCoalescedEvents === 'function'
        ? ((nativeEv as any).getCoalescedEvents() as Array<PointerEvent>)
        : [nativeEv];

    for (const e of coalescedEvents) {
      const point = this.getPointData(e);
      this.currentStrokePoints.push(point);
    }

    this.renderLiveStroke();
  };

  /**
   * Se dispara cuando el usuario levanta el puntero.
   */
  private handlePointerUp = () => {
    console.log('--- POINTER UP ---'); // <-- DEBE APARECER
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // VKTOR: ¡LA CLAVE! Llama a la función de limpieza pesada AHORA.
    if (this.currentStrokePoints.length > 0) {
      this.finalizeStroke();
    }

    // Preparamos un nuevo gráfico para el siguiente trazo
    this.currentStrokeGraphic = new PIXI.Graphics();
    this.app.stage.addChild(this.currentStrokeGraphic);
  };

  // --- Lógica de Renderizado ---

  /**
   * Procesa los puntos crudos con perfect-freehand y los dibuja en la GPU.
   * VKTOR: ¡VERSIÓN RÁPIDA (HOT PATH)!
   * Esta versión es "sucia" pero extremadamente rápida — sólo para pointermove.
   */
  private renderLiveStroke() {
    const options = {
      size: 16,
      thinning: 0.7,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: this.currentStrokePoints.length > 0 && this.currentStrokePoints[0][2] === 0.5,
    };

    const strokePolygonPoints = getStroke(this.currentStrokePoints, options);

    if (strokePolygonPoints.length === 0) {
      this.currentStrokeGraphic.clear();
      return;
    }

    // VKTOR: Dibujo "sucio" y rápido directo a la GPU.
    // Usamos drawPolygon porque es la forma más rápida,
    // aceptando los artefactos de 'earcut' temporalmente.
    this.currentStrokeGraphic.clear();
    this.currentStrokeGraphic.beginFill(0xeeeeee);
    this.currentStrokeGraphic.drawPolygon(strokePolygonPoints.flat());
    this.currentStrokeGraphic.endFill();
  }

  /**
   * Se llama UNA VEZ al final de un trazo (en pointerup).
   * Ejecuta el trabajo pesado de limpieza de geometría.
   */
  private finalizeStroke() {
    // 1. Obtener la geometría final de perfect-freehand
    const options = {
      size: 16,
      thinning: 0.7,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: this.currentStrokePoints.length > 0 && this.currentStrokePoints[0][2] === 0.5,
    };
    const strokePolygonPoints = getStroke(this.currentStrokePoints, options);

    if (strokePolygonPoints.length === 0) {
      this.currentStrokeGraphic.clear();
      return;
    }

    // 2. Ejecutar RDP (Ramer-Douglas-Peucker) para simplificar
    const points = strokePolygonPoints.map(p => [p[0], p[1]] as number[]);
    const epsilon = this.RDP_EPS_BASE * (window.devicePixelRatio || 1);
    const decimated = this.rdpSimplify(points, epsilon);

    // 3. Ejecutar 'polygon-clipping' para sanear auto-intersecciones
    const complexPolygonGeo = [decimated.map(p => [p[0], p[1]])];
    let cleanMultiPolygon: any = [];
    try {
      const res = clipping.union(complexPolygonGeo as any);
      cleanMultiPolygon = res || [];
    } catch (e) {
      console.warn('polygon-clipping falló, usando polígono decimado', e);
      cleanMultiPolygon = [complexPolygonGeo]; // Fallback
    }

    // 4. Renderizado Final y Limpio
    this.currentStrokeGraphic.clear();
    this.currentStrokeGraphic.beginFill(0xeeeeee);
    for (const polygon of cleanMultiPolygon) {
      const outerRing = polygon[0];
      if (!outerRing || outerRing.length === 0) continue;

      this.currentStrokeGraphic.moveTo(outerRing[0][0], outerRing[0][1]);
      for (let i = 1; i < outerRing.length; i++) {
        this.currentStrokeGraphic.lineTo(outerRing[i][0], outerRing[i][1]);
      }
      this.currentStrokeGraphic.closePath();

      // Manejo de agujeros (si tu build de PIXI lo soporta)
      if (polygon.length > 1) {
        for (let h = 1; h < polygon.length; h++) {
          const holeRing = polygon[h];
          if (typeof (this.currentStrokeGraphic as any).beginHole === 'function') {
            (this.currentStrokeGraphic as any).beginHole();
            this.currentStrokeGraphic.moveTo(holeRing[0][0], holeRing[0][1]);
            for (let i = 1; i < holeRing.length; i++) {
              this.currentStrokeGraphic.lineTo(holeRing[i][0], holeRing[i][1]);
            }
            this.currentStrokeGraphic.closePath();
            (this.currentStrokeGraphic as any).endHole();
          }
        }
      }
    }
    this.currentStrokeGraphic.endFill();
  }

  /**
   * Helper para extraer y normalizar datos del puntero.
   */
  private rdpSimplify = (pts: number[][], eps: number): number[][] => {
    const sqDist = (p1: number[], p2: number[]) => {
      const dx = p1[0] - p2[0];
      const dy = p1[1] - p2[1];
      return dx * dx + dy * dy;
    };

    const perpSqDist = (p: number[], a: number[], b: number[]) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      if (dx === 0 && dy === 0) return sqDist(p, a);
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
      const proj: number[] = [a[0] + t * dx, a[1] + t * dy];
      return sqDist(p, proj);
    };

    const recurse = (ptsArr: number[][], start: number, end: number, epsSq: number, out: boolean[]) => {
      let maxIdx = -1;
      let maxDist = 0;
      for (let i = start + 1; i < end; i++) {
        const d = perpSqDist(ptsArr[i], ptsArr[start], ptsArr[end]);
        if (d > maxDist) {
          maxDist = d;
          maxIdx = i;
        }
      }
      if (maxDist > epsSq) {
        out[maxIdx] = true;
        recurse(ptsArr, start, maxIdx, epsSq, out);
        recurse(ptsArr, maxIdx, end, epsSq, out);
      }
    };

    if (pts.length < 3) return pts.slice();
    const outMask: boolean[] = new Array(pts.length).fill(false);
    outMask[0] = true;
    outMask[pts.length - 1] = true;
    recurse(pts, 0, pts.length - 1, eps * eps, outMask);
    const res: number[][] = [];
    for (let i = 0; i < pts.length; i++) if (outMask[i]) res.push(pts[i]);
    return res;
  };

  private getPointData = (event: any | PointerEvent | MouseEvent): number[] => {
    let x: number, y: number;
    let pressure: number;

    if ('global' in event) {
      // 1. Es un FederatedPointerEvent (de Pixi)
      x = event.global.x;
      y = event.global.y;
      pressure = event.pressure ?? 0.5;
    } else {
      // 2. Es un PointerEvent o MouseEvent nativo (de coalescedEvents)
      x = event.x;
      y = event.y;
      // Comprueba si es PointerEvent (tiene 'pressure') o MouseEvent (simula presión)
      pressure = (event instanceof PointerEvent) ? event.pressure : 0.5;
    }
    
    return [x, y, pressure];
  };
}

// Iniciar la aplicación
new VektorApp();