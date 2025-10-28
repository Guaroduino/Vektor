// VKTOR: Arquitectura de "Triangle Strip" (Trapecios)
console.log('--- VektorApp main.ts (triangle-strip-SWAP_FIX) Cargado ---');

import {
  Application,
  Graphics,
  Container, // <-- Usamos Container para la escena principal
  TickerPlugin,
  EventSystem,
  extensions,
  FederatedPointerEvent, // <-- Usamos tipos de eventos fuertes
  Geometry,
} from 'pixi.js';

import './style.css';

// Registramos plugins
extensions.add(TickerPlugin);
extensions.add(EventSystem);

/**
 * Clase principal que inicializa el motor gráfico de Vektor.
 */
class VektorApp {
  // VKTOR: Tipos de Pixi.js corregidos
  private app: Application;
  private sceneContainer: Container; // <-- Contiene los trazos finalizados
  private brushLayer: Graphics; // <-- Solo para la vista previa EN VIVO

  private isDrawing = false;
  private prevPoint: number[] | null = null; // [x, y, pressure]

  // Parámetros del pincel
  private size: number = 16;
  private segmentAlpha: number = 1.0;
  private simulatePressure: boolean = true;

  constructor() {
    this.app = new Application();
    
    // VKTOR: Arquitectura de capas correcta
    // 'sceneContainer' almacena los trazos terminados
    this.sceneContainer = new Container();
    // 'brushLayer' es SÓLO la vista previa. Se borra constantemente.
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

    // VKTOR: Añadir capas al escenario
    this.app.stage.addChild(this.sceneContainer);
    this.app.stage.addChild(this.brushLayer); // La vista previa siempre encima

    // VKTOR: Conectar eventos
    this.app.stage.on('pointerdown', this.handlePointerDown);
    this.app.stage.on('pointermove', this.handlePointerMove);
    this.app.stage.on('pointerup', this.handlePointerUp);
    this.app.stage.on('pointerupoutside', this.handlePointerUp);

    console.log('Vektor Engine Inicializado. Modo pincel de trapecios.');
    this.setupControls(); // Tu código de UI
  }
  
  /**
   * Vincula sliders/checkbox de UI con parámetros internos.
   * (Tu código, sin cambios)
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
  }

  // --- Manejadores de Eventos (Hilo Principal) ---

  private handlePointerDown = (event: FederatedPointerEvent) => {
    this.isDrawing = true;
    
    // VKTOR: Limpia la capa de VISTA PREVIA al iniciar un nuevo trazo.
    // Esto está bien porque `brushLayer` es un objeto nuevo (ver handlePointerUp)
    this.brushLayer.clear();
    
    this.prevPoint = this.getPointData(event);
  };

  private handlePointerMove = (event: FederatedPointerEvent) => {
    if (!this.isDrawing) return;

    const nativeEv = event.nativeEvent as MouseEvent | PointerEvent;
    const coalescedEvents: Array<MouseEvent | PointerEvent> =
      typeof (nativeEv as any).getCoalescedEvents === 'function'
        ? ((nativeEv as any).getCoalescedEvents() as Array<PointerEvent>)
        : [nativeEv];

    // VKTOR: Dibuja un segmento de trapecio por CADA punto de alta frecuencia
    for (const e of coalescedEvents) {
      const curPoint = this.getPointData(e);
      
      if (!this.prevPoint) {
        this.prevPoint = curPoint;
        continue;
      }
      
      // Dibuja el trapecio que conecta el punto anterior con el actual
      this.drawTrapezoidSegment(this.prevPoint, curPoint);
      this.prevPoint = curPoint; // Actualiza el punto anterior
    }
  };

  /**
   * VKTOR: ¡VERSIÓN CORREGIDA CON "INTERCAMBIO" (SWAPPING)!
   * "Confirma" el trazo de la vista previa a la escena principal.
   */
  private handlePointerUp = () => {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.prevPoint = null;

    // 1. Si no se dibujó nada en la vista previa, no hacer nada.
    if (this.brushLayer.geometry.graphicsData.length === 0) {
      return;
    }

    // 2. "Graduar" la capa de vista previa para que sea el trazo final.
    const finalStroke = this.brushLayer;
    
    // 3. Aplicar la opacidad deseada al trazo finalizado.
    finalStroke.alpha = this.segmentAlpha;

    // 4. Mover el trazo al contenedor de la escena principal.
    this.sceneContainer.addChild(finalStroke);

    // 5. Crear un NUEVO objeto Graphics (vacío) para la próxima vista previa.
    this.brushLayer = new Graphics();
    
    // 6. Añadir esta NUEVA capa de vista previa al escenario (encima de todo).
    this.app.stage.addChild(this.brushLayer);
  };
  
  // --- Dibujo del pincel de "Trapecios" (Triangle Strip) ---

  /**
   * Dibuja un único segmento de trapecio (dos triángulos)
   * que conecta el punto A con el punto B.
   */
  private drawTrapezoidSegment(a: number[], b: number[]) {
    const ax = a[0], ay = a[1], ap = this.simulatePressure ? a[2] ?? 0.5 : 1.0;
    const bx = b[0], by = b[1], bp = this.simulatePressure ? b[2] ?? 0.5 : 1.0;

    let dx = bx - ax;
    let dy = by - ay;
    let dist = Math.hypot(dx, dy);
    
    // Evitar división por cero si los puntos son idénticos
    if (dist < 0.001) return;

    // Vector perpendicular (normal)
    const px = -dy / dist;
    const py = dx / dist;

    // Ancho del trazo en el punto A y B, basado en la presión
    const aWidth = (this.size * ap) * 0.5;
    const bWidth = (this.size * bp) * 0.5;

    // Vértices del trapecio
    const x1 = ax + px * aWidth; // A (izquierda)
    const y1 = ay + py * aWidth;
    const x2 = ax - px * aWidth; // A (derecha)
    const y2 = ay - py * aWidth;
    const x3 = bx - px * bWidth; // B (derecha)
    const y3 = by - py * bWidth;
    const x4 = bx + px * bWidth; // B (izquierda)
    const y4 = by + py * bWidth;

    // VKTOR: Usamos beginFill/endFill para rellenar la forma.
    this.brushLayer.beginFill(0xeeeeee);
    this.brushLayer.moveTo(x1, y1);
    this.brushLayer.lineTo(x2, y2);
    this.brushLayer.lineTo(x3, y3);
    this.brushLayer.lineTo(x4, y4);
    this.brushLayer.closePath();
    this.brushLayer.endFill();
  }

  /**
   * Helper para extraer y normalizar datos del puntero.
   */
  private getPointData = (event: FederatedPointerEvent | PointerEvent | MouseEvent): number[] => {
    let x: number, y: number;
    let pressure: number;

    if ('global' in event) {
      // Es un FederatedPointerEvent (de Pixi)
      x = event.global.x;
      y = event.global.y;
      pressure = event.pressure ?? 0.5;
    } else {
      // Es un PointerEvent o MouseEvent nativo (de coalescedEvents)
      x = event.x;
      y = event.y;
      pressure = (event instanceof PointerEvent) ? event.pressure : 0.5;
    }
    
    return [x, y, pressure];
  };
}

// Iniciar la aplicación
new VektorApp();